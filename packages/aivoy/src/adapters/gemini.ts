import type { ChatAdapter, ChatChunk, ChatRequest } from '../core/types';
import { messageToText, zodToJsonSchema } from './util';

export interface GeminiAdapterOptions {
  apiKey: string;
  model?: string;
  baseURL?: string;
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

function toGeminiContents(req: ChatRequest): GeminiContent[] {
  const out: GeminiContent[] = [];
  for (const m of req.messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', parts: [{ text: messageToText(m) }] });
    } else if (m.role === 'assistant') {
      const parts: GeminiPart[] = [];
      for (const p of m.parts) {
        if (p.kind === 'text' && p.text) parts.push({ text: p.text });
      }
      for (const tc of m.toolCalls ?? []) {
        parts.push({
          functionCall: {
            name: tc.name,
            args: (tc.args as Record<string, unknown>) ?? {},
          },
        });
      }
      if (parts.length > 0) out.push({ role: 'model', parts });
    }
  }
  if (req.toolResults?.length) {
    out.push({
      role: 'user',
      parts: req.toolResults.map((r) => ({
        functionResponse: {
          name: r.name,
          response: { result: r.result, isError: r.isError ?? false },
        },
      })),
    });
  }
  return out;
}

/**
 * Google Gemini streaming adapter (browser, REST `streamGenerateContent`).
 *
 * ⚠️ DEV-ONLY. Calling Gemini directly from the browser exposes your API key.
 * For production, use `proxyAdapter` and call Gemini server-side.
 */
export function geminiAdapter(opts: GeminiAdapterOptions): ChatAdapter {
  const model = opts.model ?? 'gemini-1.5-flash';
  const baseURL = opts.baseURL ?? 'https://generativelanguage.googleapis.com/v1beta';

  return {
    async *stream(req: ChatRequest): AsyncIterable<ChatChunk> {
      const tools =
        req.tools.length > 0
          ? [
              {
                functionDeclarations: req.tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: zodToJsonSchema(t.input),
                })),
              },
            ]
          : undefined;

      const body = {
        systemInstruction: { role: 'system', parts: [{ text: req.system }] },
        contents: toGeminiContents(req),
        ...(tools ? { tools } : {}),
      };

      const url = `${baseURL}/models/${model}:streamGenerateContent?alt=sse&key=${opts.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: req.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        yield { type: 'error', error: `Gemini ${res.status}: ${text || res.statusText}` };
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let toolCounter = 0;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nlnl: number;
        while ((nlnl = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, nlnl);
          buffer = buffer.slice(nlnl + 2);
          const dataLine = event.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const payload = dataLine.slice(5).trim();
          if (!payload) continue;

          try {
            const json = JSON.parse(payload) as {
              candidates?: { content?: { parts?: GeminiPart[] } }[];
            };
            const parts = json.candidates?.[0]?.content?.parts ?? [];
            for (const p of parts) {
              if (p.text) yield { type: 'text', delta: p.text };
              if (p.functionCall) {
                yield {
                  type: 'tool_call',
                  id: `gem_${++toolCounter}`,
                  name: p.functionCall.name,
                  args: p.functionCall.args ?? {},
                };
              }
            }
          } catch {
            // ignore malformed line
          }
        }
      }
    },
  };
}
