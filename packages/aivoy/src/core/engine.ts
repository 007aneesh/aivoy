import type {
  AssistantConfig,
  ChatAdapter,
  ChatRequest,
  ConciergeEvent,
  Message,
  ToolCallRecord,
} from './types';
import { ToolRegistry } from './toolRegistry';

const MAX_TOOL_LOOPS = 6;

export interface EngineDeps {
  adapter: ChatAdapter;
  registry: ToolRegistry;
  context: Record<string, unknown>;
  assistant: AssistantConfig;
  emit: (event: ConciergeEvent) => void;
}

export interface EngineCallbacks {
  /** Append/replace assistant message in store. */
  upsertAssistant: (message: Message) => void;
  /** Mark assistant message as no longer pending. */
  finalize: (id: string) => void;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildSystemPrompt(assistant: AssistantConfig, context: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(
    `You are ${assistant.name}, an AI concierge embedded inside a web application. ` +
      `Be concise, helpful, and grounded. When you need real data, call a tool — do not fabricate. ` +
      `Prefer rendering structured results via tools (which the UI turns into rich cards) over long prose.`,
  );
  if (Object.keys(context).length > 0) {
    lines.push('\n--- Host context (read-only) ---');
    lines.push(JSON.stringify(context, null, 2));
  }
  if (assistant.systemPrompt) {
    lines.push('\n--- Additional instructions ---');
    lines.push(assistant.systemPrompt);
  }
  return lines.join('\n');
}

/**
 * Run one user turn: stream a reply, execute any tool calls, loop until the model is done.
 * Mutates the assistant message in-place via callbacks so the UI streams live.
 */
export async function runTurn(
  history: Message[],
  deps: EngineDeps,
  callbacks: EngineCallbacks,
  signal: AbortSignal,
): Promise<void> {
  const { adapter, registry, context, assistant, emit } = deps;

  const assistantMsg: Message = {
    id: uid('m'),
    role: 'assistant',
    parts: [],
    pending: true,
    toolCalls: [],
    createdAt: Date.now(),
  };
  callbacks.upsertAssistant(assistantMsg);

  const system = buildSystemPrompt(assistant, context);
  const tools = registry.list();

  let messages = history;
  let pendingToolResults: ChatRequest['toolResults'] = undefined;

  for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
    if (signal.aborted) {
      callbacks.finalize(assistantMsg.id);
      return;
    }

    const stream = adapter.stream({
      messages,
      system,
      tools,
      toolResults: pendingToolResults,
      signal,
    });

    pendingToolResults = undefined;
    const toolCallsThisLoop: ToolCallRecord[] = [];
    let textBuffer = '';

    try {
      for await (const chunk of stream) {
        if (signal.aborted) {
          callbacks.finalize(assistantMsg.id);
          return;
        }

        if (chunk.type === 'text') {
          textBuffer += chunk.delta;
          // Update or append the trailing text part.
          const last = assistantMsg.parts[assistantMsg.parts.length - 1];
          if (last && last.kind === 'text') {
            last.text = textBuffer;
          } else {
            assistantMsg.parts.push({ kind: 'text', text: textBuffer });
          }
          callbacks.upsertAssistant({ ...assistantMsg, parts: [...assistantMsg.parts] });
        } else if (chunk.type === 'tool_call') {
          const record: ToolCallRecord = {
            id: chunk.id,
            name: chunk.name,
            args: chunk.args,
            status: 'running',
          };
          toolCallsThisLoop.push(record);
          assistantMsg.toolCalls = [...(assistantMsg.toolCalls ?? []), record];
          callbacks.upsertAssistant({ ...assistantMsg });
          emit({ type: 'tool_call', name: chunk.name, args: chunk.args });
        } else if (chunk.type === 'tool_status') {
          // Cloud-orchestrated tool call — purely informational. Add or
          // update a chip on the assistant message; no local execution.
          const existing = (assistantMsg.toolCalls ?? []).find((tc) => tc.id === chunk.id);
          if (existing) {
            existing.status = chunk.status === 'running' ? 'running' : chunk.status;
          } else {
            assistantMsg.toolCalls = [
              ...(assistantMsg.toolCalls ?? []),
              {
                id: chunk.id,
                name: chunk.name,
                args: undefined,
                status: chunk.status === 'running' ? 'running' : chunk.status,
              },
            ];
          }
          // Reset text buffer so any post-tool text starts a fresh part.
          textBuffer = '';
          callbacks.upsertAssistant({ ...assistantMsg });
        } else if (chunk.type === 'card') {
          assistantMsg.parts.push({
            kind: 'card',
            card: { type: chunk.cardType, data: chunk.data },
          });
          // Reset text buffer so the next text delta starts a new part after the card.
          textBuffer = '';
          callbacks.upsertAssistant({ ...assistantMsg, parts: [...assistantMsg.parts] });
        } else if (chunk.type === 'error') {
          assistantMsg.parts.push({ kind: 'text', text: `\n_Error: ${chunk.error}_` });
          callbacks.upsertAssistant({ ...assistantMsg });
          emit({ type: 'error', error: chunk.error });
        } else if (chunk.type === 'done') {
          // handled below
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      assistantMsg.parts.push({ kind: 'text', text: `\n_Error: ${error}_` });
      callbacks.upsertAssistant({ ...assistantMsg });
      emit({ type: 'error', error });
      callbacks.finalize(assistantMsg.id);
      return;
    }

    if (toolCallsThisLoop.length === 0) {
      // No tool calls → the turn is done.
      callbacks.finalize(assistantMsg.id);
      emit({ type: 'message_received', message: assistantMsg });
      return;
    }

    // Reset text buffer between loops so the next round's text starts fresh in a new part.
    textBuffer = '';

    // Execute every tool call in parallel.
    const toolResults = await Promise.all(
      toolCallsThisLoop.map(async (tc) => {
        const out = await registry.run(tc.name, tc.args, { context, signal });
        if (out.ok) {
          tc.result = out.result;
          tc.status = 'done';
          emit({ type: 'tool_result', name: tc.name, result: out.result });
          // If tool wants card rendering, push the card directly into the assistant message.
          if (out.renderAs) {
            assistantMsg.parts.push({
              kind: 'card',
              card: { type: out.renderAs, data: out.result },
            });
            callbacks.upsertAssistant({ ...assistantMsg });
          }
          return {
            id: tc.id,
            name: tc.name,
            result: out.result,
            isError: false,
          };
        } else {
          tc.error = out.error;
          tc.status = 'error';
          emit({ type: 'tool_error', name: tc.name, error: out.error });
          return {
            id: tc.id,
            name: tc.name,
            result: { error: out.error },
            isError: true,
          };
        }
      }),
    );

    callbacks.upsertAssistant({ ...assistantMsg });

    // Pass results back to the model on the next loop. We include the assistant turn
    // we just built (so the model sees its own tool calls) and the tool result envelope.
    messages = [...history, assistantMsg];
    pendingToolResults = toolResults;
  }

  // Safety: hit the loop cap.
  assistantMsg.parts.push({
    kind: 'text',
    text: '\n_Stopped: too many tool calls in one turn._',
  });
  callbacks.upsertAssistant({ ...assistantMsg });
  callbacks.finalize(assistantMsg.id);
}
