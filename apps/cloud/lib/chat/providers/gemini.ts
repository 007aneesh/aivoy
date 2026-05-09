import type { ProviderChunk, ProviderMessage, ProviderRunArgs } from '../types';

/** Gemini streaming via streamGenerateContent (SSE). */
export async function* runGemini(
  args: ProviderRunArgs,
): AsyncIterable<ProviderChunk> {
  const baseUrl = (args.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(
    /\/$/,
    '',
  );

  const tools = args.tools.length
    ? [
        {
          functionDeclarations: args.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ]
    : undefined;

  const body = {
    systemInstruction: { role: 'system', parts: [{ text: args.system }] },
    contents: toGeminiContents(args.messages),
    ...(tools ? { tools } : {}),
  };

  const url = `${baseUrl}/models/${args.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(args.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: args.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    if (res.status === 429) {
      yield { type: 'error', error: 'Too many requests right now. Please wait a moment and try again.' };
    } else {
      yield { type: 'error', error: `Gemini ${res.status}: ${text || res.statusText}` };
    }
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let toolCounter = 0;
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
          candidates?: {
            content?: {
              parts?: {
                text?: string;
                functionCall?: { name: string; args: Record<string, unknown> };
              }[];
            };
          }[];
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
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
        if (json.usageMetadata) {
          inputTokens = json.usageMetadata.promptTokenCount ?? inputTokens;
          outputTokens = json.usageMetadata.candidatesTokenCount ?? outputTokens;
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

function toGeminiContents(history: ProviderMessage[]) {
  const out: {
    role: 'user' | 'model';
    parts: {
      text?: string;
      functionCall?: { name: string; args: Record<string, unknown> };
      functionResponse?: { name: string; response: Record<string, unknown> };
    }[];
  }[] = [];

  for (const m of history) {
    if (m.role === 'user') {
      out.push({ role: 'user', parts: [{ text: m.content ?? '' }] });
    } else if (m.role === 'assistant') {
      const parts: (typeof out)[number]['parts'] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls ?? []) {
        parts.push({ functionCall: { name: tc.name, args: tc.args } });
      }
      if (parts.length) out.push({ role: 'model', parts });
    } else if (m.role === 'tool' && m.toolName) {
      out.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: m.toolName,
              response: { result: m.toolResult, isError: m.toolIsError ?? false },
            },
          },
        ],
      });
    }
  }
  return out;
}
