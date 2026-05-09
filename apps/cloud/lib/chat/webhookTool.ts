import { createHmac } from 'node:crypto';
import type { ServerTool } from './types';

const TIMEOUT_MS = 15_000;

export interface WebhookResult {
  ok: boolean;
  /** Either the parsed JSON response body (ok=true) or an error string. */
  result: unknown;
  status: number;
}

/**
 * Calls a tool's webhook with the LLM-supplied args, signs the payload with
 * the TENANT's signing secret (one secret across every tool), and returns a
 * JSON-parsed body.
 *
 * Signing scheme (mirror Stripe):
 *   timestamp = unix seconds
 *   signature = HMAC-SHA256(secret, "{timestamp}.{rawBody}")
 *   header    = "t={timestamp},v1={signature}"
 *
 * Tenants verify by recomputing on their side using AIVOY_WEBHOOK_SECRET.
 */
export async function invokeWebhook(
  tool: ServerTool,
  args: Record<string, unknown>,
  ctx: { tenantId: string; tokenId: string; signingSecret: string; requestId?: string },
  signal: AbortSignal,
): Promise<WebhookResult> {
  const payload = JSON.stringify({
    tool: tool.name,
    args,
    tenantId: ctx.tenantId,
    tokenId: ctx.tokenId,
  });

  const ts = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', ctx.signingSecret)
    .update(`${ts}.${payload}`)
    .digest('hex');

  // Combine the caller's signal with our own timeout so a slow webhook
  // doesn't stall the chat stream forever.
  const ac = new AbortController();
  const onAbort = () => ac.abort(signal.reason);
  if (signal.aborted) ac.abort(signal.reason);
  else signal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => ac.abort(new Error('webhook timeout')), TIMEOUT_MS);

  try {
    const res = await fetch(tool.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Aivoy-Signature': `t=${ts},v1=${signature}`,
        'User-Agent': 'aivoy-webhook/1.0',
        ...(ctx.requestId ? { 'X-Aivoy-Request-Id': ctx.requestId } : {}),
      },
      body: payload,
      signal: ac.signal,
    });

    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Leave as raw string — the LLM can still reason over it.
    }

    if (!res.ok) {
      return {
        ok: false,
        result: { error: typeof body === 'string' ? body : (body ?? `HTTP ${res.status}`) },
        status: res.status,
      };
    }
    return { ok: true, result: body, status: res.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, result: { error: msg }, status: 0 };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}
