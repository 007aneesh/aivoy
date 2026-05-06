import type { ChatAdapter, ChatChunk, ChatRequest } from '../core/types';

export interface MockAdapterOptions {
  /** Custom scripted reply per user message; falls back to a canned one. */
  reply?: (req: ChatRequest) => Iterable<ChatChunk> | AsyncIterable<ChatChunk>;
  /** Per-chunk delay in ms, for visible streaming during dev. */
  delayMs?: number;
}

/**
 * Mock adapter — useful for development, tests, and demos without API keys.
 * Streams a canned response by default.
 */
export function mockAdapter(opts: MockAdapterOptions = {}): ChatAdapter {
  const delay = opts.delayMs ?? 25;

  return {
    async *stream(req: ChatRequest): AsyncIterable<ChatChunk> {
      const source = opts.reply ? opts.reply(req) : defaultReply(req);
      for await (const chunk of source as AsyncIterable<ChatChunk>) {
        if (req.signal.aborted) return;
        if (delay > 0) await sleep(delay);
        yield chunk;
      }
      yield { type: 'done' };
    },
  };
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function* defaultReply(req: ChatRequest): AsyncIterable<ChatChunk> {
  const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
  const text = lastUser?.parts.find((p) => p.kind === 'text');
  const userText = text?.kind === 'text' ? text.text : 'there';

  const reply =
    `Hi! I'm a mock adapter — I can't reach a real LLM, but I heard you say: "${userText}". ` +
    `Wire me up to \`openaiAdapter\`, \`anthropicAdapter\`, or \`proxyAdapter\` for the real thing.`;

  for (const word of reply.split(/(\s+)/)) {
    yield { type: 'text', delta: word };
  }
}
