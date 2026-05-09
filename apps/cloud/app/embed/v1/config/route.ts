/**
 * Public widget bootstrap. The embed loader fetches this with a Bearer token
 * (Authorization header — never query string) and uses the response to
 * populate the widget UI: name, greeting, suggested prompts, theme.
 *
 * Origin is allowlist-checked. Token must be active.
 *
 * Nothing in the response is secret — these are all values the end user was
 * going to see anyway.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { ChatAuthError, loadChatContext } from '@/lib/chat/tokenContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get('origin')),
  });
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');

  // Reuse the chat-context loader to keep token + origin enforcement in
  // exactly one place. We don't actually need the credential or tools here,
  // but the auth side-effects (revoked, origin) are exactly what we want.
  let ctx;
  try {
    ctx = await loadChatContext(req.headers.get('authorization'), origin);
  } catch (e) {
    if (e instanceof ChatAuthError) {
      return jsonError(e.status, e.message, origin);
    }
    return jsonError(500, e instanceof Error ? e.message : 'Internal error', origin);
  }

  const [assistant] = await db
    .select()
    .from(schema.assistants)
    .where(eq(schema.assistants.tenantId, ctx.tenant.id))
    .limit(1);

  return NextResponse.json(
    {
      assistant: {
        name: assistant?.name ?? 'Ask Aivoy',
        avatarUrl: assistant?.avatarUrl ?? null,
        greeting: assistant?.greeting ?? null,
        suggestedPrompts: assistant?.suggestedPrompts ?? [],
        theme: assistant?.theme ?? {},
      },
    },
    { headers: corsHeaders(origin) },
  );
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-cache',
    Vary: 'Origin',
  };
}

function jsonError(status: number, message: string, origin: string | null) {
  return NextResponse.json(
    { error: message },
    { status, headers: corsHeaders(origin) },
  );
}
