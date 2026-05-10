import type { Assistant } from '@/db/schema';
import type {
  ChatContext,
  ClientToolDef,
  ProviderMessage,
  ServerChunk,
  ServerTool,
  WireMessage,
} from './types';
import { streamProvider } from './providers';
import { invokeWebhook } from './webhookTool';
import { log } from '../log';

const MAX_TOOL_LOOPS = 3;

export interface RunTurnInput {
  ctx: ChatContext;
  messages: WireMessage[];
  /** Tools the WIDGET will execute (e.g. browser-only capabilities like
   *  geolocation). Cloud merges these into the LLM tool list but never
   *  invokes them — when the LLM calls one, we emit a `client_tool_call`
   *  chunk and end the turn so the widget can run it locally and resume. */
  clientTools: ClientToolDef[];
  /** Correlates with route-level + webhook logs for tracing. */
  requestId: string;
  signal: AbortSignal;
}

export interface RunTurnTotals {
  inputTokens: number;
  outputTokens: number;
  toolCallCount: number;
}

/**
 * Runs one user turn end-to-end on the server. Streams ServerChunks for the
 * widget; resolves with token-usage totals so the route handler can log.
 */
export async function* runTurn(
  input: RunTurnInput,
): AsyncGenerator<ServerChunk, RunTurnTotals> {
  const { ctx, messages, clientTools, requestId, signal } = input;
  const system = buildSystemPrompt(ctx.assistant);

  // Convert wire messages to provider-shape. The widget can now send
  // assistant turns with toolCalls (when resuming after a client tool ran)
  // and tool result messages — pass both through verbatim.
  let providerHistory: ProviderMessage[] = messages.map<ProviderMessage>((m) => {
    if (m.role === 'user') return { role: 'user', content: m.content };
    if (m.role === 'tool') {
      return {
        role: 'tool',
        toolCallId: m.toolCallId,
        toolName: m.name,
        toolResult: m.result,
        toolIsError: m.isError ?? false,
      };
    }
    return {
      role: 'assistant',
      content: m.content,
      ...(m.toolCalls && m.toolCalls.length > 0 ? { toolCalls: m.toolCalls } : {}),
    };
  });

  // Combined tool list visible to the LLM. Server-registered tools execute
  // via webhook; client tools shape-match ServerTool but are flagged with a
  // null webhookUrl so we can short-circuit them in the loop below.
  const clientToolNames = new Set(clientTools.map((t) => t.name));
  const combinedTools: ServerTool[] = [
    ...ctx.tools,
    ...clientTools.map<ServerTool>((t) => ({
      id: `client:${t.name}`,
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      webhookUrl: '',
      renderAs: null,
    })),
  ];

  const totals: RunTurnTotals = { inputTokens: 0, outputTokens: 0, toolCallCount: 0 };
  const perTurnCap = ctx.token.perTurnTokenCap ?? null;
  let budgetExceeded = false;
  const overBudget = () =>
    perTurnCap != null && totals.inputTokens + totals.outputTokens >= perTurnCap;

  // Turn-level cache. Some models (Llama 3.3 on Groq) repeat the same
  // (name, args) tool call across separate iterations even though the result
  // is already in their context. We cache by stable key and short-circuit
  // every duplicate to the cached result — no extra webhook hit, no duplicate
  // user-visible chip.
  interface CachedResult {
    ok: boolean;
    result: unknown;
    renderAs: string | null;
    /** Whether we've already emitted a tool_status + card to the client. */
    surfaced: boolean;
  }
  const cache = new Map<string, CachedResult>();

  for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
    if (signal.aborted) return totals;

    const stream = streamProvider(ctx.credential, {
      apiKey: ctx.apiKey,
      system,
      messages: providerHistory,
      tools: combinedTools,
      signal,
    });

    const toolCalls: { id: string; name: string; args: Record<string, unknown>; argsParseError?: string }[] = [];
    let assistantText = '';
    let errored = false;
    // Llama 3.3 sometimes "describes" tool calls as pseudo-XML in the text
    // channel (e.g. `<function=foo args=...>`). Buffer until we're confident
    // the text isn't leaked syntax, then flush. The buffer is intentionally
    // tiny so streaming feel survives.
    const LEAK_BUFFER_MAX = 120;
    // Patterns Llama 3.3 leaks instead of using the tool_calls field. Each
    // entry triggers suppression + retry as soon as the text channel matches.
    const LEAK_RE =
      /<function\s*=|<tool\s*=|^\[tool:|^\{"?function|<\|python_tag\|>|<\|tool_call\|>|<\|begin_of_tool|<\|tool_response\|>/i;
    // End-of-stream sanity check — catches naked python-style function call
    // descriptions like `getNearbyStays(lat=…)` that don't trip the streaming
    // regex. Only used as a final guard, not for suppression mid-stream.
    const LEAK_RE_FULL =
      /(?:^|\n)\s*\w+\(\s*\w+\s*=/;
    let leakBuffer = '';
    let leakDetected = false;
    let bufferFlushed = false;
    const flushBuffer = function* (): Generator<ServerChunk> {
      if (bufferFlushed) return;
      if (leakBuffer) yield { type: 'text', delta: leakBuffer };
      leakBuffer = '';
      bufferFlushed = true;
    };

    for await (const chunk of stream) {
      if (signal.aborted) return totals;

      if (chunk.type === 'text') {
        assistantText += chunk.delta;
        if (leakDetected) {
          // Already detected — silently drop the rest, retry at end.
          continue;
        }
        if (!bufferFlushed) {
          leakBuffer += chunk.delta;
          if (LEAK_RE.test(leakBuffer)) {
            leakDetected = true;
            leakBuffer = '';
            continue;
          }
          if (leakBuffer.length >= LEAK_BUFFER_MAX) {
            yield* flushBuffer();
          }
          continue;
        }
        yield { type: 'text', delta: chunk.delta };
      } else if (chunk.type === 'tool_call') {
        toolCalls.push({
          id: chunk.id,
          name: chunk.name,
          args: chunk.args,
          ...(chunk.argsParseError ? { argsParseError: chunk.argsParseError } : {}),
        });
      } else if (chunk.type === 'usage') {
        totals.inputTokens += chunk.inputTokens;
        totals.outputTokens += chunk.outputTokens;
      } else if (chunk.type === 'error') {
        errored = true;
        yield { type: 'error', error: chunk.error };
      } else if (chunk.type === 'done') {
        // single-loop terminator — handled by leaving the for-await
      }
    }

    // End-of-stream second pass: belt-and-braces. Re-scan the full
    // assistantText (including anything still buffered) against BOTH the
    // streaming regex and the python-style function-call regex. Whatever
    // slipped past the streaming detector gets caught here. The cost is
    // that the leaked text already streamed to the widget — but the widget
    // will receive a follow-up clean retry below, and the empty-bubble
    // guard prevents the leaked-only bubble from rendering on its own.
    const fullText = leakBuffer + assistantText;
    if (
      !leakDetected &&
      toolCalls.length === 0 &&
      (LEAK_RE.test(fullText) || LEAK_RE_FULL.test(fullText))
    ) {
      leakDetected = true;
    }

    // Flush any clean text the leak-detector was holding back.
    if (!leakDetected) {
      yield* flushBuffer();
    } else {
      log.warn('chat.tool_leak_suppressed', {
        requestId,
        tenantId: ctx.tenant.id,
        tokenId: ctx.token.id,
        sample: assistantText.slice(0, 200),
      });
      // Drop anything we were holding back — the empty-turn retry path
      // below will make a clean follow-up call.
      leakBuffer = '';
      bufferFlushed = true;
      assistantText = '';
    }

    if (errored) return totals;

    if (overBudget()) {
      budgetExceeded = true;
      yield {
        type: 'error',
        error: `Per-turn token budget reached (${perTurnCap} tokens). Stopping.`,
      };
      break;
    }

    if (toolCalls.length === 0) {
      // Llama 3.3 sometimes terminates a turn with neither text nor tool
      // calls — usually after a tool result whose shape it doesn't know
      // how to narrate. Don't leave the user staring at an empty bubble:
      // retry once with a no-tools prompt forcing a textual reply.
      if (assistantText.trim().length === 0) {
        log.warn('chat.empty_turn_retry', {
          requestId,
          tenantId: ctx.tenant.id,
          tokenId: ctx.token.id,
        });
        const retry = streamProvider(ctx.credential, {
          apiKey: ctx.apiKey,
          system:
            system +
            '\n\nThe previous turn produced no reply. Summarize the most recent tool ' +
            'result for the user in plain language — DO NOT call any tools.',
          messages: providerHistory,
          tools: [],
          signal,
        });
        let retryText = '';
        for await (const chunk of retry) {
          if (signal.aborted) break;
          if (chunk.type === 'text') {
            retryText += chunk.delta;
            yield { type: 'text', delta: chunk.delta };
          } else if (chunk.type === 'usage') {
            totals.inputTokens += chunk.inputTokens;
            totals.outputTokens += chunk.outputTokens;
          } else if (chunk.type === 'error') {
            yield { type: 'error', error: chunk.error };
            break;
          }
        }
        if (retryText.trim().length === 0) {
          // Retry also empty — surface a friendly fallback so the bubble
          // isn't silently blank.
          yield {
            type: 'text',
            delta:
              "I couldn't generate a reply for that. Could you rephrase or give me more detail?",
          };
        }
      }
      yield { type: 'done' };
      return totals;
    }

    // If the LLM called any CLIENT tool, hand it off to the widget. We emit
    // each client tool call as `client_tool_call`, end the turn, and let
    // the widget run them locally then re-POST the conversation with the
    // tool results appended. Server-side tool calls in the same response
    // are dropped — mixing client + server tool dispatch in one turn is
    // not supported.
    const clientCalls = toolCalls.filter((tc) => clientToolNames.has(tc.name));
    if (clientCalls.length > 0) {
      for (const tc of clientCalls) {
        if (tc.argsParseError) {
          yield {
            type: 'error',
            error: `Invalid arguments for ${tc.name}: ${tc.argsParseError}`,
          };
          continue;
        }
        yield {
          type: 'client_tool_call',
          id: tc.id,
          name: tc.name,
          args: tc.args,
        };
      }
      yield { type: 'done' };
      return totals;
    }

    // Append assistant turn (text + tool calls) to history.
    providerHistory = [
      ...providerHistory,
      {
        role: 'assistant',
        content: assistantText || undefined,
        toolCalls,
      },
    ];

    // Group by (name, args) to dedupe within this iteration AND across
    // iterations of the same turn. The `cache` map is the cross-iteration
    // memory; it short-circuits any (name,args) we've already executed.
    type ToolCall = (typeof toolCalls)[number];
    interface Group {
      key: string;
      calls: ToolCall[];
      renderAs: string | null;
      cached: CachedResult | null;
    }
    const groupsMap = new Map<string, Group>();
    for (const tc of toolCalls) {
      const key = `${tc.name}::${stableStringify(tc.args)}`;
      let g = groupsMap.get(key);
      if (!g) {
        g = {
          key,
          calls: [],
          renderAs: ctx.tools.find((t) => t.name === tc.name)?.renderAs ?? null,
          cached: cache.get(key) ?? null,
        };
        groupsMap.set(key, g);
      }
      g.calls.push(tc);
    }
    const groups = [...groupsMap.values()];

    // Emit a 'running' chip for every fresh (uncached) group BEFORE we kick
    // off webhooks, so the user sees something happening during the request.
    for (const g of groups) {
      if (g.cached) continue;
      const first = g.calls[0]!;
      yield {
        type: 'tool_status',
        id: first.id,
        name: first.name,
        status: 'running',
        renderAs: g.renderAs,
      };
    }

    // Execute only the groups we don't already have a cached answer for.
    await Promise.all(
      groups.map(async (g) => {
        if (g.cached) return; // hit; webhook is skipped entirely
        const first = g.calls[0]!;
        const tool = ctx.tools.find((t) => t.name === first.name);
        let entry: CachedResult;
        if (first.argsParseError) {
          // Don't run the webhook — feed the parse error back so the model retries.
          entry = {
            ok: false,
            result: {
              error: `Invalid arguments for tool ${first.name}: ${first.argsParseError}. Retry the tool call with valid JSON arguments matching the tool's schema.`,
            },
            renderAs: g.renderAs,
            surfaced: false,
          };
        } else if (!tool) {
          entry = {
            ok: false,
            result: { error: `Unknown tool: ${first.name}` },
            renderAs: g.renderAs,
            surfaced: false,
          };
        } else {
          const webhookStart = Date.now();
          const out = await invokeWebhook(
            tool,
            first.args,
            {
              tenantId: ctx.tenant.id,
              tokenId: ctx.token.id,
              signingSecret: ctx.tenant.webhookSigningSecret,
              requestId,
            },
            signal,
          );
          log.info('chat.tool_invoke', {
            requestId,
            tenantId: ctx.tenant.id,
            tool: first.name,
            httpStatus: out.status,
            ok: out.ok,
            latencyMs: Date.now() - webhookStart,
          });
          entry = {
            ok: out.ok,
            result: out.ok ? out.result : { error: out.result },
            renderAs: g.renderAs,
            surfaced: false,
          };
        }
        cache.set(g.key, entry);
        g.cached = entry;
      }),
    );

    // Surface only on first occurrence per (name, args). Emit a final
    // 'done'/'error' status chip for every fresh group, then the card on
    // success. The chip is what flips the "spinner" emitted above to a
    // checkmark on the widget side.
    for (const g of groups) {
      const entry = g.cached!;
      const first = g.calls[0]!;
      if (!entry.surfaced) {
        totals.toolCallCount += 1;
        yield {
          type: 'tool_status',
          id: first.id,
          name: first.name,
          status: entry.ok ? 'done' : 'error',
          renderAs: entry.renderAs,
        };
        if (entry.ok && entry.renderAs) {
          yield { type: 'card', cardType: entry.renderAs, data: entry.result };
        }
        entry.surfaced = true;
      }
    }

    // Append tool-result messages for EVERY tool_call id (including
    // duplicates AND cache hits) so the LLM sees all of its calls resolved.
    //
    // For tools rendered as cards, the user already SEES the full payload —
    // feeding it all back to the LLM just to narrate burns input tokens
    // (and on free-tier Groq, blows the per-minute TPM bucket). Replace
    // with a tiny stub: count + ids/titles. The model still has enough
    // context to write "Here are 3 stays under ₹5k" without re-ingesting
    // every field.
    providerHistory = [
      ...providerHistory,
      ...groups.flatMap((g) => {
        const entry = g.cached!;
        const trimmed = entry.ok && entry.renderAs ? summarizeForLLM(entry.result) : entry.result;
        return g.calls.map<ProviderMessage>((call) => ({
          role: 'tool',
          toolCallId: call.id,
          toolName: call.name,
          toolResult: trimmed,
          toolIsError: !entry.ok,
        }));
      }),
    ];
  }

  // Loop cap reached: do one final no-tools call so the model is forced to
  // narrate what it found instead of leaving the user with bare cards.
  // Skip if we exited early due to per-turn budget — another LLM call would
  // defeat the cap.
  if (!signal.aborted && !budgetExceeded) {
    const wrapStream = streamProvider(ctx.credential, {
      apiKey: ctx.apiKey,
      system:
        system +
        '\n\nYou have used the maximum number of tool calls for this turn. ' +
        'Summarize what you found for the user using the tool results already in context. Do NOT call any more tools.',
      messages: providerHistory,
      tools: [],
      signal,
    });
    for await (const chunk of wrapStream) {
      if (signal.aborted) break;
      if (chunk.type === 'text') {
        yield { type: 'text', delta: chunk.delta };
      } else if (chunk.type === 'usage') {
        totals.inputTokens += chunk.inputTokens;
        totals.outputTokens += chunk.outputTokens;
      } else if (chunk.type === 'error') {
        yield { type: 'error', error: chunk.error };
        break;
      }
    }
  }

  yield { type: 'done' };
  return totals;
}

/**
 * JSON.stringify with object keys sorted recursively. Used to build a stable
 * cache key for deduping tool calls with the same args but different key order.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        sorted[k] = (v as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return v;
  });
}

/**
 * Reduce a card-rendered tool result to the smallest payload the model needs
 * to narrate it. The user already sees the visual cards — the LLM only needs
 * count + identifiers to say "Here are X stays". Cuts narration-loop input
 * cost by ~80% on listing-card responses.
 */
function summarizeForLLM(result: unknown): unknown {
  if (Array.isArray(result)) {
    return {
      count: result.length,
      items: result.slice(0, 12).map((item) => {
        if (item && typeof item === 'object') {
          const r = item as Record<string, unknown>;
          const out: Record<string, unknown> = {};
          if (r.id != null) out.id = r.id;
          if (typeof r.title === 'string') out.title = r.title;
          if (typeof r.subtitle === 'string') out.subtitle = r.subtitle;
          if (r.price && typeof r.price === 'object') {
            const p = r.price as Record<string, unknown>;
            out.price = { amount: p.amount, currency: p.currency };
          }
          return out;
        }
        return item;
      }),
    };
  }
  return result;
}

function buildSystemPrompt(assistant: Assistant | null): string {
  const lines: string[] = [];
  const name = assistant?.name ?? 'Ask Aivoy';
  // Minimal core prompt — domain-specific guidance (location, price, etc.)
  // belongs in the tenant's `assistant.systemPrompt` field, NOT here. Every
  // word here costs tokens on every turn for every tenant.
  lines.push(
    `You are ${name}. Be concise. Use tools for real data; don't fabricate. ` +
      'Use the structured tool_calls field — never emit tool calls as text. ' +
      'Use only the exact tool names you have access to.',
  );
  if (assistant?.systemPrompt) {
    lines.push('\n--- Additional instructions ---');
    lines.push(assistant.systemPrompt);
  }
  return lines.join('\n');
}
