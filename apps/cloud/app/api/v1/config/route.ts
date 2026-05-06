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

/**
 * Public widget bootstrap. The embed loader fetches this with the public
 * token (?token=pk_...) and uses it to populate the widget UI: name,
 * greeting, suggested prompts, theme. Origin is allowlist-checked.
 *
 * Nothing in the response is secret — these are all values the end user
 * was going to see anyway.
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  // Reuse the chat-context loader to keep token + origin enforcement in
  // exactly one place. We don't actually need the credential or tools here,
  // but the auth side-effects (revoked, origin) are exactly what we want.
  let ctx;
  try {
    ctx = await loadChatContext(
      token ? `Bearer ${token}` : null,
      origin,
    );
  } catch (e) {
    if (e instanceof ChatAuthError) {
      return jsonError(e.status, e.message, origin);
    }
    return jsonError(500, e instanceof Error ? e.message : 'Internal error', origin);
  }

  // Fetch assistant — already loaded by chat context, but re-select for the
  // canonical shape that excludes provider-credential link.
  const [assistant] = await db
    .select()
    .from(schema.assistants)
    .where(eq(schema.assistants.tenantId, ctx.tenant.id))
    .limit(1);

  return NextResponse.json(
    {
      assistant: {
        name: assistant?.name ?? 'Assistant',
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
