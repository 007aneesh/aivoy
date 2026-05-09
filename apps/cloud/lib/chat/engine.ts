import type { Assistant } from '@/db/schema';
import type {
  ChatContext,
  ProviderMessage,
  ServerChunk,
  WireMessage,
} from './types';
import { streamProvider } from './providers';
import { invokeWebhook } from './webhookTool';

const MAX_TOOL_LOOPS = 3;

export interface RunTurnInput {
  ctx: ChatContext;
  messages: WireMessage[];
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
  const { ctx, messages, signal } = input;
  const system = buildSystemPrompt(ctx.assistant);

  // Convert wire messages to provider-shape (no tool turns yet — those are
  // populated by the multi-turn loop below).
  let providerHistory: ProviderMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const totals: RunTurnTotals = { inputTokens: 0, outputTokens: 0, toolCallCount: 0 };

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
      tools: ctx.tools,
      signal,
    });

    const toolCalls: { id: string; name: string; args: Record<string, unknown> }[] = [];
    let assistantText = '';
    let errored = false;

    for await (const chunk of stream) {
      if (signal.aborted) return totals;

      if (chunk.type === 'text') {
        assistantText += chunk.delta;
        yield { type: 'text', delta: chunk.delta };
      } else if (chunk.type === 'tool_call') {
        toolCalls.push(chunk);
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

    if (errored) return totals;

    if (toolCalls.length === 0) {
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

    if (groups.every((g) => g.cached)) {
      yield { type: 'done' };
      return totals;
    }

    // Execute only the groups we don't already have a cached answer for.
    await Promise.all(
      groups.map(async (g) => {
        if (g.cached) return; // hit; webhook is skipped entirely
        const first = g.calls[0]!;
        const tool = ctx.tools.find((t) => t.name === first.name);
        let entry: CachedResult;
        if (!tool) {
          entry = {
            ok: false,
            result: { error: `Unknown tool: ${first.name}` },
            renderAs: g.renderAs,
            surfaced: false,
          };
        } else {
          const out = await invokeWebhook(
            tool,
            first.args,
            {
              tenantId: ctx.tenant.id,
              tokenId: ctx.token.id,
              signingSecret: ctx.tenant.webhookSigningSecret,
            },
            signal,
          );
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

    // Surface only on first occurrence per (name, args). On success the card
    // is the signal — emit chip only on error so failures aren't silent.
    for (const g of groups) {
      const entry = g.cached!;
      const first = g.calls[0]!;
      if (!entry.surfaced) {
        totals.toolCallCount += 1;
        if (entry.ok) {
          if (entry.renderAs) {
            yield { type: 'card', cardType: entry.renderAs, data: entry.result };
          }
        } else {
          yield {
            type: 'tool_status',
            id: first.id,
            name: first.name,
            status: 'error',
            renderAs: entry.renderAs,
          };
        }
        entry.surfaced = true;
      }
    }

    // Append tool-result messages for EVERY tool_call id (including
    // duplicates AND cache hits) so the LLM sees all of its calls resolved.
    providerHistory = [
      ...providerHistory,
      ...groups.flatMap((g) => {
        const entry = g.cached!;
        return g.calls.map<ProviderMessage>((call) => ({
          role: 'tool',
          toolCallId: call.id,
          toolName: call.name,
          toolResult: entry.result,
          toolIsError: !entry.ok,
        }));
      }),
    ];
  }

  // Loop cap.
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

function buildSystemPrompt(assistant: Assistant | null): string {
  const lines: string[] = [];
  const name = assistant?.name ?? 'Ask Aivoy';
  lines.push(
    `You are ${name}, an AI concierge embedded inside a web application. ` +
      'Be concise, helpful, and grounded. When you need real data, call a tool — do not fabricate. ' +
      'Prefer rendering structured results via tools (which the UI turns into rich cards) over long prose.',
  );
  if (assistant?.systemPrompt) {
    lines.push('\n--- Additional instructions ---');
    lines.push(assistant.systemPrompt);
  }
  return lines.join('\n');
}
