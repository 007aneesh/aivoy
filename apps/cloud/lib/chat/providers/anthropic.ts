import type { ProviderChunk, ProviderMessage, ProviderRunArgs } from '../types';

/** Anthropic Messages streaming (server-side, no dangerous-direct-browser flag). */
export async function* runAnthropic(
  args: ProviderRunArgs,
): AsyncIterable<ProviderChunk> {
  const baseUrl = (args.baseUrl ?? 'https://api.anthropic.com/v1').replace(/\/$/, '');

  const tools = args.tools.length
    ? args.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }))
    : undefined;

  const body = {
    model: args.model,
    stream: true,
    max_tokens: 4096,
    system: args.system,
    messages: toAnthropicMessages(args.messages),
    ...(tools ? { tools } : {}),
  };

  const res = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': args.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: args.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    yield { type: 'error', error: `Anthropic ${res.status}: ${text || res.statusText}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const toolBlocks = new Map<number, { id: string; name: string; argsJson: string }>();
  let inputTokens = 0;
  let outputTokens = 0;

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
          content_block?: {
            type: string;
            id?: string;
            name?: string;
          };
          delta?: {
            type?: string;
            text?: string;
            partial_json?: string;
          };
          message?: { usage?: { input_tokens?: number; output_tokens?: number } };
          usage?: { input_tokens?: number; output_tokens?: number };
        };

        if (json.type === 'message_start' && json.message?.usage) {
          inputTokens = json.message.usage.input_tokens ?? 0;
        } else if (json.type === 'message_delta' && json.usage) {
          outputTokens = json.usage.output_tokens ?? outputTokens;
        } else if (json.type === 'content_block_start' && json.content_block) {
          const cb = json.content_block;
          if (cb.type === 'tool_use' && typeof json.index === 'number' && cb.id && cb.name) {
            toolBlocks.set(json.index, { id: cb.id, name: cb.name, argsJson: '' });
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
            let parsed: Record<string, unknown> = {};
            try {
              parsed = slot.argsJson ? (JSON.parse(slot.argsJson) as Record<string, unknown>) : {};
            } catch {
              parsed = {};
            }
            yield { type: 'tool_call', id: slot.id, name: slot.name, args: parsed };
            toolBlocks.delete(json.index);
          }
        } else if (json.type === 'message_stop') {
          if (inputTokens || outputTokens) {
            yield { type: 'usage', inputTokens, outputTokens };
          }
          return;
        }
      } catch {
        // ignore
      }
    }
  }

  if (inputTokens || outputTokens) {
    yield { type: 'usage', inputTokens, outputTokens };
  }
}

function toAnthropicMessages(history: ProviderMessage[]) {
  // Anthropic groups consecutive tool_results into one user message with
  // multiple tool_result blocks. Walk linearly and coalesce.
  const out: { role: 'user' | 'assistant'; content: ContentBlock[] }[] = [];

  type ContentBlock =
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
    | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

  for (const m of history) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: [{ type: 'text', text: m.content ?? '' }] });
    } else if (m.role === 'assistant') {
      const blocks: ContentBlock[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const tc of m.toolCalls ?? []) {
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args });
      }
      if (blocks.length) out.push({ role: 'assistant', content: blocks });
    } else if (m.role === 'tool' && m.toolCallId) {
      const block: ContentBlock = {
        type: 'tool_result',
        tool_use_id: m.toolCallId,
        content: JSON.stringify(m.toolResult ?? null),
        is_error: m.toolIsError,
      };
      const last = out[out.length - 1];
      if (last && last.role === 'user') {
        last.content.push(block);
      } else {
        out.push({ role: 'user', content: [block] });
      }
    }
  }

  return out;
}
