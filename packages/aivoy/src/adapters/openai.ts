import type { ChatAdapter, ChatChunk, ChatRequest, Message } from '../core/types';
import { messageToText, zodToJsonSchema } from './util';

export interface OpenAIAdapterOptions {
  apiKey: string;
  model?: string;
  baseURL?: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
  name?: string;
}

function toOpenAIMessages(req: ChatRequest): ChatMessage[] {
  const out: ChatMessage[] = [{ role: 'system', content: req.system }];
  for (const m of req.messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: messageToText(m) });
    } else if (m.role === 'assistant') {
      const text = m.parts
        .filter((p) => p.kind === 'text')
        .map((p) => (p.kind === 'text' ? p.text : ''))
        .join('');
      const tool_calls = m.toolCalls?.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.args ?? {}) },
      }));
      const msg: ChatMessage = {
        role: 'assistant',
        content: text || null,
      };
      if (tool_calls && tool_calls.length > 0) msg.tool_calls = tool_calls;
      out.push(msg);
    }
  }
  if (req.toolResults) {
    for (const r of req.toolResults) {
      out.push({
        role: 'tool',
        tool_call_id: r.id,
        content: JSON.stringify(r.result),
      });
    }
  }
  return out;
}

/**
 * OpenAI Chat Completions streaming adapter (browser).
 *
 * ⚠️ DEV-ONLY. Calling OpenAI directly from the browser exposes your API key.
 * For production, use `proxyAdapter` and call OpenAI server-side.
 */
export function openaiAdapter(opts: OpenAIAdapterOptions): ChatAdapter {
  const model = opts.model ?? 'gpt-4o-mini';
  const baseURL = opts.baseURL ?? 'https://api.openai.com/v1';

  return {
    async *stream(req: ChatRequest): AsyncIterable<ChatChunk> {
      const tools =
        req.tools.length > 0
          ? req.tools.map((t) => ({
              type: 'function' as const,
              function: {
                name: t.name,
                description: t.description,
                parameters: zodToJsonSchema(t.input),
              },
            }))
          : undefined;

      const body = {
        model,
        stream: true,
        messages: toOpenAIMessages(req),
        ...(tools ? { tools } : {}),
      };

      const res = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: req.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        yield { type: 'error', error: `OpenAI ${res.status}: ${text || res.statusText}` };
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Accumulate streaming tool-call args by index, since OpenAI sends them in deltas.
      const pendingTools = new Map<
        number,
        { id?: string; name?: string; args: string }
      >();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line || !line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') {
            for (const [, tc] of pendingTools) {
              if (tc.id && tc.name) {
                let parsedArgs: unknown = {};
                try {
                  parsedArgs = JSON.parse(tc.args || '{}');
                } catch {
                  parsedArgs = {};
                }
                yield { type: 'tool_call', id: tc.id, name: tc.name, args: parsedArgs };
              }
            }
            pendingTools.clear();
            return;
          }

          try {
            const json = JSON.parse(payload) as {
              choices?: {
                delta?: {
                  content?: string;
                  tool_calls?: {
                    index: number;
                    id?: string;
                    function?: { name?: string; arguments?: string };
                  }[];
                };
              }[];
            };
            const delta = json.choices?.[0]?.delta;
            if (!delta) continue;
            if (delta.content) yield { type: 'text', delta: delta.content };
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const slot = pendingTools.get(tc.index) ?? { args: '' };
                if (tc.id) slot.id = tc.id;
                if (tc.function?.name) slot.name = tc.function.name;
                if (tc.function?.arguments) slot.args += tc.function.arguments;
                pendingTools.set(tc.index, slot);
              }
            }
          } catch {
            // ignore malformed line
          }
        }
      }

      // Flush any pending tool calls if stream ended without [DONE].
      for (const [, tc] of pendingTools) {
        if (tc.id && tc.name) {
          let parsedArgs: unknown = {};
          try {
            parsedArgs = JSON.parse(tc.args || '{}');
          } catch {
            parsedArgs = {};
          }
          yield { type: 'tool_call', id: tc.id, name: tc.name, args: parsedArgs };
        }
      }
    },
  };
}

// Help TS treat Message as used (re-export type for adapter consumers if needed).
export type { Message };
