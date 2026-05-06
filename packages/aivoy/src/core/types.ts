import type { ZodTypeAny, z } from 'zod';

/** A single piece of structured content the LLM can render in-thread. */
export interface Card<T = unknown> {
  type: string;
  data: T;
}

export interface TextPart {
  kind: 'text';
  text: string;
}

export interface CardPart {
  kind: 'card';
  card: Card;
}

export type MessagePart = TextPart | CardPart;

export type Role = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: Role;
  parts: MessagePart[];
  /** Set while streaming; flips false on done. */
  pending?: boolean;
  /** Tool calls the assistant produced for this turn. */
  toolCalls?: ToolCallRecord[];
  createdAt: number;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
  error?: string;
  status: 'running' | 'done' | 'error';
}

/** Tool definition. The single source of truth for both the LLM tool spec and runtime executor. */
export interface Tool<TInput extends ZodTypeAny = ZodTypeAny, TOutput = unknown> {
  name: string;
  description: string;
  input: TInput;
  run: (args: z.infer<TInput>, ctx: ToolRunContext) => Promise<TOutput> | TOutput;
  /** If set, a successful result is rendered as a card of this type instead of being summarized as text. */
  renderAs?: string;
}

export interface ToolRunContext {
  /** Static context passed to <Concierge context={...} />. Read-only. */
  context: Record<string, unknown>;
  /** Abort signal — fires if the user closes the panel mid-call or sends a new message. */
  signal: AbortSignal;
}

/** Helper for type-safe tool registration. */
export function defineTool<TInput extends ZodTypeAny, TOutput>(
  tool: Tool<TInput, TOutput>,
): Tool<TInput, TOutput> {
  return tool;
}

/**
 * Streaming chunks emitted by every adapter.
 *
 * `tool_call` is emitted by client-side adapters (openai/anthropic/gemini) so
 * the engine can run a registered tool locally. The cloud adapter never emits
 * `tool_call` — the cloud orchestrates tool execution server-side and instead
 * emits `tool_status` (informational; widget renders a chip) and `card`
 * (a structured message part the widget appends as a card).
 */
export type ChatChunk =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown }
  | {
      type: 'tool_status';
      id: string;
      name: string;
      status: 'running' | 'done' | 'error';
      renderAs?: string | null;
    }
  | { type: 'card'; cardType: string; data: unknown }
  | { type: 'done' }
  | { type: 'error'; error: string };

export interface ChatRequest {
  /** Conversation history (excluding system message). */
  messages: Message[];
  /** System prompt — assistant identity + serialized context. */
  system: string;
  /** Available tool defs. Adapters convert to provider-specific shape. */
  tools: Tool[];
  /** Tool results to feed back after a tool_call (when continuing a turn). */
  toolResults?: { id: string; name: string; result: unknown; isError?: boolean }[];
  signal: AbortSignal;
}

export interface ChatAdapter {
  /** Streams a single round-trip with the LLM. The engine handles the multi-turn loop. */
  stream(req: ChatRequest): AsyncIterable<ChatChunk>;
}

export interface AssistantConfig {
  name: string;
  avatarUrl?: string;
  greeting?: string | ((ctx: Record<string, unknown>) => string);
  /** Quick-tap prompts shown in the empty state. */
  suggestedPrompts?: string[];
  /** Extra system-prompt text appended to the auto-generated one. */
  systemPrompt?: string;
}

export interface ThemeConfig {
  accent?: string;
  radius?: 'sm' | 'md' | 'lg' | 'xl';
  position?: 'bottom-right' | 'bottom-left';
  mode?: 'light' | 'dark' | 'auto';
}

export interface PersistenceConfig {
  strategy: 'none' | 'local' | 'remote';
  key?: string;
  load?: () => Promise<Message[] | null> | Message[] | null;
  save?: (messages: Message[]) => Promise<void> | void;
}

export type ConciergeEvent =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'message_sent'; text: string }
  | { type: 'message_received'; message: Message }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'tool_error'; name: string; error: string }
  | { type: 'error'; error: string };
