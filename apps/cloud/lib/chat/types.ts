/**
 * Server-side chat types. The widget never sees these — it only sees the
 * NDJSON ChatChunk stream that this module emits.
 */

import type { ProviderCredential, Tool, Tenant, IntegrationToken, Assistant } from '@/db/schema';

/** A tool in its server-side shape: input is JSON Schema (not zod). */
export interface ServerTool {
  id: string;
  name: string;
  description: string;
  /** JSON Schema. Pass-through to the LLM. */
  parameters: Record<string, unknown>;
  webhookUrl: string;
  webhookSecret: string;
  renderAs: string | null;
}

/**
 * Resolved per-request context. Built once at the top of the route handler
 * after we've validated the bearer token + Origin.
 */
export interface ChatContext {
  token: IntegrationToken;
  tenant: Tenant;
  assistant: Assistant | null;
  credential: ProviderCredential;
  /** Decrypted provider API key. Lives in memory only for the duration of the request. */
  apiKey: string;
  tools: ServerTool[];
}

/** A wire-format message sent from the widget. */
export interface WireMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Wire chunks the server streams back as NDJSON. Mirrors the package's ChatChunk
 *  but with extra `tool_status` events so the widget can render chips for
 *  server-orchestrated tool calls without having to execute them. */
export type ServerChunk =
  | { type: 'text'; delta: string }
  | { type: 'tool_status'; id: string; name: string; status: 'running' | 'done' | 'error'; renderAs?: string | null }
  | { type: 'card'; cardType: string; data: unknown }
  | { type: 'done' }
  | { type: 'error'; error: string };

/** Provider-level streaming chunks — what individual provider runners emit. */
export type ProviderChunk =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'error'; error: string }
  | { type: 'done' };

/** Args passed to every provider runner. */
export interface ProviderRunArgs {
  apiKey: string;
  baseUrl: string | null;
  model: string;
  system: string;
  messages: ProviderMessage[];
  tools: ServerTool[];
  signal: AbortSignal;
}

/** Internal provider-shaped message — same as wire but with assistant tool_calls
 *  for the multi-turn loop. */
export interface ProviderMessage {
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  /** Set on assistant turns when the model called tools we then resolved. */
  toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
  /** Set on tool messages with the result the webhook returned. */
  toolCallId?: string;
  toolName?: string;
  toolResult?: unknown;
  toolIsError?: boolean;
}
