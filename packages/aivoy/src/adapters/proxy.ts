import type { ChatAdapter, ChatChunk, ChatRequest } from '../core/types';
import { messageToText } from './util';

export interface ProxyAdapterOptions {
  /** URL of the host's chat endpoint. POSTs `{ messages }`, replies NDJSON ChatChunks. */
  url: string;
  /** Extra headers (e.g. `Authorization: Bearer pk_...`). */
  headers?: Record<string, string> | (() => Record<string, string>);
  /** Override fetch (for testing). */
  fetch?: typeof fetch;
}

interface WireMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Talks to a server that orchestrates the LLM + tools end-to-end and streams
 * back NDJSON ChatChunks. This is the wire format used by the aivoy cloud's
 * `/api/v1/chat` and is also the recommended shape for any custom backend.
 *
 * Server contract:
 *   POST <url>
 *   Authorization: Bearer <token>           (provided via `headers`)
 *   Content-Type: application/json
 *   Body: { messages: [{ role, content }] }
 *
 *   Reply: `application/x-ndjson` — one JSON-encoded ChatChunk per line.
 *   The server is responsible for the entire turn (tool execution included)
 *   and emits `tool_status` + `card` chunks instead of `tool_call`.
 */
export function proxyAdapter(opts: ProxyAdapterOptions): ChatAdapter {
  const doFetch = opts.fetch ?? fetch;

  return {
    async *stream(req: ChatRequest): AsyncIterable<ChatChunk> {
      const body = {
        messages: req.messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map<WireMessage>((m) => ({
            role: m.role as 'user' | 'assistant',
            content: messageToText(m),
          })),
      };

      const headers =
        typeof opts.headers === 'function' ? opts.headers() : (opts.headers ?? {});

      const res = await doFetch(opts.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
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

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          try {
            yield JSON.parse(line) as ChatChunk;
          } catch {
            // ignore malformed line
          }
        }
      }

      const tail = buffer.trim();
      if (tail) {
        try {
          yield JSON.parse(tail) as ChatChunk;
        } catch {
          // ignore
        }
      }

      // Cloud already emits its own `done`; this is a fallback so consumers terminate.
      yield { type: 'done' };
    },
  };
}
