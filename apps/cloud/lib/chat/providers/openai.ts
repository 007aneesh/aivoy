import type { ProviderChunk, ProviderMessage, ProviderRunArgs } from '../types';

/**
 * OpenAI Chat Completions streaming, server-side.
 *
 * Same code path is used for xAI Grok — they speak the OpenAI shape, just
 * with a different baseUrl (https://api.x.ai/v1) and model id (grok-3-mini etc).
 */
export async function* runOpenAI(
  args: ProviderRunArgs,
): AsyncIterable<ProviderChunk> {
  const baseUrl = (args.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');

  const tools = args.tools.length
    ? args.tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }))
    : undefined;

  const body = {
    model: args.model,
    stream: true,
    stream_options: { include_usage: true },
    messages: toOpenAIMessages(args.system, args.messages),
    ...(tools ? { tools } : {}),
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: args.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    yield { type: 'error', error: `OpenAI ${res.status}: ${text || res.statusText}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
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
        yield* flushTools(pendingTools);
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
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };

        const delta = json.choices?.[0]?.delta;
        if (delta?.content) yield { type: 'text', delta: delta.content };
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const slot = pendingTools.get(tc.index) ?? { args: '' };
            if (tc.id) slot.id = tc.id;
            if (tc.function?.name) slot.name = tc.function.name;
            if (tc.function?.arguments) slot.args += tc.function.arguments;
            pendingTools.set(tc.index, slot);
          }
        }
        if (json.usage) {
          yield {
            type: 'usage',
            inputTokens: json.usage.prompt_tokens ?? 0,
            outputTokens: json.usage.completion_tokens ?? 0,
          };
        }
      } catch {
        // ignore malformed line
      }
    }
  }

  yield* flushTools(pendingTools);
}

function* flushTools(
  pending: Map<number, { id?: string; name?: string; args: string }>,
): Generator<ProviderChunk> {
  for (const [, tc] of pending) {
    if (!tc.id || !tc.name) continue;
    let parsed: Record<string, unknown> = {};
    try {
      parsed = tc.args ? (JSON.parse(tc.args) as Record<string, unknown>) : {};
    } catch {
      // bad JSON from the model — pass through empty args; tool will likely error
    }
    yield { type: 'tool_call', id: tc.id, name: tc.name, args: parsed };
  }
  pending.clear();
}

function toOpenAIMessages(system: string, history: ProviderMessage[]) {
  const out: {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: string | null;
    tool_calls?: {
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }[];
    tool_call_id?: string;
  }[] = [{ role: 'system', content: system }];

  for (const m of history) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content ?? '' });
    } else if (m.role === 'assistant') {
      const msg: (typeof out)[number] = {
        role: 'assistant',
        content: m.content || null,
      };
      if (m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        }));
      }
      out.push(msg);
    } else if (m.role === 'tool' && m.toolCallId) {
      out.push({
        role: 'tool',
        tool_call_id: m.toolCallId,
        content: JSON.stringify(m.toolResult ?? null),
      });
    }
  }
  return out;
}
