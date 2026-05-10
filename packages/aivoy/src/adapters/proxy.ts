import type { ChatAdapter, ChatChunk, ChatRequest } from '../core/types';
import { messageToText, zodToJsonSchema } from './util';

export interface ProxyAdapterOptions {
  /** URL of the host's chat endpoint. POSTs `{ messages, clientTools? }`, replies NDJSON ChatChunks. */
  url: string;
  /** Extra headers (e.g. `Authorization: Bearer pk_...`). */
  headers?: Record<string, string> | (() => Record<string, string>);
  /** Override fetch (for testing). */
  fetch?: typeof fetch;
}

type WireMessage =
  | { role: 'user'; content: string }
  | {
      role: 'assistant';
      content?: string;
      toolCalls?: { id: string; name: string; args: unknown }[];
    }
  | {
      role: 'tool';
      toolCallId: string;
      name: string;
      result: unknown;
      isError?: boolean;
    };

/**
 * Talks to a server that orchestrates the LLM + tools end-to-end and streams
 * back NDJSON ChatChunks. Wire format used by the aivoy cloud's
 * `/embed/v1/chat`.
 *
 *   POST <url>
 *   Body: {
 *     messages: WireMessage[],            // user / assistant(+toolCalls?) / tool
 *     clientTools?: ToolDef[],            // tools the WIDGET will execute
 *   }
 *
 *   Reply: `application/x-ndjson` — one JSON-encoded ChatChunk per line.
 *
 * Client-tool flow: when the LLM calls one of the `clientTools`, the cloud
 * emits `{type:'client_tool_call', id, name, args}` and ends the turn. The
 * adapter translates that into a `tool_call` chunk so the engine's standard
 * tool-execution path handles it. The engine then re-invokes `stream()` with
 * `req.toolResults` populated; we serialize those as wire `tool` messages.
 */
export function proxyAdapter(opts: ProxyAdapterOptions): ChatAdapter {
  const doFetch = opts.fetch ?? fetch;

  return {
    async *stream(req: ChatRequest): AsyncIterable<ChatChunk> {
      const wire: WireMessage[] = [];
      for (const m of req.messages) {
        if (m.role === 'user') {
          wire.push({ role: 'user', content: messageToText(m) });
        } else if (m.role === 'assistant') {
          const text = m.parts
            .filter((p) => p.kind === 'text')
            .map((p) => (p.kind === 'text' ? p.text : ''))
            .join('');
          const toolCalls = m.toolCalls?.filter((tc) => !!tc.name) ?? [];
          if (toolCalls.length > 0) {
            wire.push({
              role: 'assistant',
              content: text || undefined,
              toolCalls: toolCalls.map((tc) => ({
                id: tc.id,
                name: tc.name,
                args: tc.args ?? {},
              })),
            });
          } else {
            wire.push({ role: 'assistant', content: text });
          }
        }
      }

      // Append tool results from the round we just finished. These show the
      // LLM the outcome of every client tool call it made on the previous turn.
      if (req.toolResults) {
        for (const r of req.toolResults) {
          wire.push({
            role: 'tool',
            toolCallId: r.id,
            name: r.name,
            result: r.result,
            isError: r.isError,
          });
        }
      }

      const clientTools = req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        // Vanilla tools ship pre-built JSON Schema; zod-tools convert on demand.
        parameters: t.parameters ?? (t.input ? zodToJsonSchema(t.input) : { type: 'object', properties: {} }),
      }));

      const headers =
        typeof opts.headers === 'function' ? opts.headers() : (opts.headers ?? {});

      const res = await doFetch(opts.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          messages: wire,
          ...(clientTools.length > 0 ? { clientTools } : {}),
        }),
        signal: req.signal,
      });

      if (!res.ok || !res.body) {
        const text = res.body ? await res.text().catch(() => '') : '';
        yield { type: 'error', error: `HTTP ${res.status}: ${text || res.statusText}` };
        yield { type: 'done' };
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const yieldChunk = function* (raw: string): Generator<ChatChunk> {
        let parsed: ChatChunk | { type: string };
        try {
          parsed = JSON.parse(raw);
        } catch {
          return;
        }
        // Normalise client_tool_call → tool_call so the engine runs it via
        // the registered local handler. The engine then loops back into
        // `stream()` with `req.toolResults` populated.
        if (parsed && (parsed as { type?: string }).type === 'client_tool_call') {
          const c = parsed as { id: string; name: string; args: unknown };
          yield { type: 'tool_call', id: c.id, name: c.name, args: c.args };
          return;
        }
        yield parsed as ChatChunk;
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          yield* yieldChunk(line);
        }
      }

      const tail = buffer.trim();
      if (tail) {
        yield* yieldChunk(tail);
      }

      // Cloud already emits its own `done`; this is a fallback so consumers terminate.
      yield { type: 'done' };
    },
  };
}
