import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/db';
import { openSecret } from '@/lib/crypto';
import type { ChatContext, ServerTool } from './types';

export class ChatAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'ChatAuthError';
    this.status = status;
  }
}

/**
 * Validates a Bearer token + Origin and hydrates the per-request context:
 * tenant, assistant config, provider credential (decrypted), and tool list.
 *
 * Throws ChatAuthError on any failure — the route handler turns that into
 * a 401/403/404 with a normalized JSON body.
 */
export async function loadChatContext(
  bearer: string | null,
  origin: string | null,
): Promise<ChatContext> {
  const token = parseBearer(bearer);
  if (!token) throw new ChatAuthError('Missing or malformed Authorization header');

  // 1. Token row, not revoked.
  const [tokenRow] = await db
    .select()
    .from(schema.integrationTokens)
    .where(
      and(
        eq(schema.integrationTokens.publicToken, token),
        isNull(schema.integrationTokens.revokedAt),
      ),
    )
    .limit(1);
  if (!tokenRow) throw new ChatAuthError('Invalid or revoked token', 401);

  // 2. Origin allowlist. Empty list means "no browser origin allowed —
  //    server-to-server only" so we require a non-null Origin to be present.
  if (tokenRow.allowedOrigins.length > 0) {
    if (!origin || !tokenRow.allowedOrigins.includes(origin)) {
      throw new ChatAuthError(
        `Origin "${origin ?? '<missing>'}" is not allowed for this token`,
        403,
      );
    }
  }

  // 3. Tenant.
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tokenRow.tenantId))
    .limit(1);
  if (!tenant) throw new ChatAuthError('Tenant missing', 500);

  // 4. Assistant config (one per tenant for v1).
  const [assistant] = await db
    .select()
    .from(schema.assistants)
    .where(eq(schema.assistants.tenantId, tenant.id))
    .limit(1);

  // 5. Provider credential — assistant points at one, fall back to tenant's first.
  let credentialId = assistant?.providerCredentialId ?? null;
  if (!credentialId) {
    const [first] = await db
      .select({ id: schema.providerCredentials.id })
      .from(schema.providerCredentials)
      .where(eq(schema.providerCredentials.tenantId, tenant.id))
      .limit(1);
    credentialId = first?.id ?? null;
  }
  if (!credentialId) {
    throw new ChatAuthError(
      'Tenant has no provider configured. Add one in the dashboard.',
      409,
    );
  }
  const [credential] = await db
    .select()
    .from(schema.providerCredentials)
    .where(eq(schema.providerCredentials.id, credentialId))
    .limit(1);
  if (!credential) throw new ChatAuthError('Provider credential missing', 500);

  const apiKey = await openSecret(credential.encryptedKey);

  // 6. Tools.
  const toolRows = await db
    .select()
    .from(schema.tools)
    .where(
      and(eq(schema.tools.tenantId, tenant.id), eq(schema.tools.enabled, true)),
    );

  const tools: ServerTool[] = toolRows.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    parameters: t.inputSchema,
    webhookUrl: t.webhookUrl,
    webhookSecret: t.webhookSecret,
    renderAs: t.renderAs,
  }));

  return {
    token: tokenRow,
    tenant,
    assistant: assistant ?? null,
    credential,
    apiKey,
    tools,
  };
}

function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return m?.[1] ?? null;
}
