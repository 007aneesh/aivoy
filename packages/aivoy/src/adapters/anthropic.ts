import type { ChatAdapter, ChatChunk, ChatRequest } from '../core/types';
import { messageToText, zodToJsonSchema } from './util';

export interface AnthropicAdapterOptions {
  apiKey: string;
  model?: string;
  baseURL?: string;
  maxTokens?: number;
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: ContentBlock[] | string;
}

function toAnthropicMessages(req: ChatRequest): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  for (const m of req.messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: messageToText(m) });
    } else if (m.role === 'assistant') {
      const blocks: ContentBlock[] = [];
      for (const p of m.parts) {
        if (p.kind === 'text' && p.text) blocks.push({ type: 'text', text: p.text });
      }
      for (const tc of m.toolCalls ?? []) {
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args });
      }
      if (blocks.length > 0) out.push({ role: 'assistant', content: blocks });
    }
  }
  if (req.toolResults?.length) {
    out.push({
      role: 'user',
      content: req.toolResults.map((r) => ({
        type: 'tool_result' as const,
        tool_use_id: r.id,
        content: JSON.stringify(r.result),
        is_error: r.isError,
      })),
    });
  }
  return out;
}

/**
 * Anthropic Messages streaming adapter (browser).
 *
 * ⚠️ DEV-ONLY. Calling Anthropic directly from the browser exposes your API key.
 * For production, use `proxyAdapter` and call Anthropic server-side.
 */
export function anthropicAdapter(opts: AnthropicAdapterOptions): ChatAdapter {
  const model = opts.model ?? 'claude-sonnet-4-6';
  const baseURL = opts.baseURL ?? 'https://api.anthropic.com/v1';
  const maxTokens = opts.maxTokens ?? 1024;

  return {
    async *stream(req: ChatRequest): AsyncIterable<ChatChunk> {
      const tools =
        req.tools.length > 0
          ? req.tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: zodToJsonSchema(t.input),
            }))
          : undefined;

      const body = {
        model,
        stream: true,
        max_tokens: maxTokens,
        system: req.system,
        messages: toAnthropicMessages(req),
        ...(tools ? { tools } : {}),
      };

      const res = await fetch(`${baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': opts.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
        signal: req.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        yield {
          type: 'error',
          error: `Anthropic ${res.status}: ${text || res.statusText}`,
        };
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Track tool_use blocks by index — args come as input_json_delta strings.
      const toolBlocks = new Map<
        number,
        { id: string; name: string; argsJson: string }
      >();

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
              type: string;
              index?: number;
              content_block?: ContentBlock;
              delta?: {
                type?: string;
                text?: string;
                partial_json?: string;
              };
            };

            if (json.type === 'content_block_start' && json.content_block) {
              const cb = json.content_block;
              if (cb.type === 'tool_use' && typeof json.index === 'number' && cb.id && cb.name) {
                toolBlocks.set(json.index, {
                  id: cb.id,
                  name: cb.name,
                  argsJson: '',
                });
              }
            } else if (json.type === 'content_block_delta' && json.delta) {
              if (json.delta.type === 'text_delta' && json.delta.text) {
                yield { type: 'text', delta: json.delta.text };
              } else if (
                json.delta.type === 'input_json_delta' &&
                typeof json.index === 'number' &&
                typeof json.delta.partial_json === 'string'
              ) {
                const slot = toolBlocks.get(json.index);
                if (slot) slot.argsJson += json.delta.partial_json;
              }
            } else if (json.type === 'content_block_stop' && typeof json.index === 'number') {
              const slot = toolBlocks.get(json.index);
              if (slot) {
                let parsedArgs: unknown = {};
                try {
                  parsedArgs = slot.argsJson ? JSON.parse(slot.argsJson) : {};
                } catch {
                  parsedArgs = {};
                }
                yield {
                  type: 'tool_call',
                  id: slot.id,
                  name: slot.name,
                  args: parsedArgs,
                };
                toolBlocks.delete(json.index);
              }
            } else if (json.type === 'message_stop') {
              return;
            }
          } catch {
            // ignore malformed line
          }
        }
      }
    },
  };
}
