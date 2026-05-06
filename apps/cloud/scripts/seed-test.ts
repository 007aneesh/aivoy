/**
 * Seeds a synthetic provider credential, tool, and integration token for the
 * existing tenant — so we can curl /api/v1/chat without a dashboard.
 *
 * Usage:
 *   pnpm --filter @aivoy/cloud exec tsx scripts/seed-test.ts <provider-api-key>
 *
 * Provider/model are configurable via env: SEED_PROVIDER (default grok),
 * SEED_MODEL (default grok-3-mini), SEED_BASE_URL.
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { sealSecret, generatePublicToken } from '../lib/crypto';

async function main() {
  const apiKey = process.argv[2];
  if (!apiKey) {
    console.error('Usage: tsx scripts/seed-test.ts <provider-api-key>');
    process.exit(1);
  }

  const provider = (process.env.SEED_PROVIDER ?? 'grok') as
    | 'openai'
    | 'anthropic'
    | 'gemini'
    | 'grok';
  const model = process.env.SEED_MODEL ?? defaultModel(provider);
  const baseUrl = process.env.SEED_BASE_URL ?? null;
  const allowedOrigin = process.env.SEED_ORIGIN ?? 'http://localhost:5173';
  const webhookUrl = process.env.SEED_WEBHOOK ?? 'http://localhost:4111/tools/searchListings';

  // Pick the first tenant in the DB.
  const [tenant] = await db.select().from(schema.tenants).limit(1);
  if (!tenant) {
    console.error('No tenants exist. Sign up via the dashboard first.');
    process.exit(1);
  }

  // Provider credential.
  const encryptedKey = await sealSecret(apiKey);
  const [credential] = await db
    .insert(schema.providerCredentials)
    .values({
      tenantId: tenant.id,
      provider,
      label: `${provider} (seeded)`,
      encryptedKey,
      model,
      baseUrl,
    })
    .returning();

  // Assistant config — point at the credential.
  await db
    .insert(schema.assistants)
    .values({
      tenantId: tenant.id,
      name: 'Aivoy',
      greeting: 'Hi! I\'m Aivoy. How can I help today?',
      suggestedPrompts: ['Show stays in Paris', 'Book me a hotel'],
      providerCredentialId: credential!.id,
    })
    .onConflictDoUpdate({
      target: schema.assistants.tenantId,
      set: { providerCredentialId: credential!.id },
    });

  // Tool — searchListings webhook. (Tenant signing secret already exists.)
  const [tool] = await db
    .insert(schema.tools)
    .values({
      tenantId: tenant.id,
      name: 'searchListings',
      description: 'Search travel stays by city and number of guests',
      webhookUrl,
      inputSchema: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'Destination city' },
          guests: { type: 'number', description: 'Number of guests' },
        },
        required: ['city', 'guests'],
      },
      renderAs: 'listingCards',
    })
    .onConflictDoUpdate({
      target: [schema.tools.tenantId, schema.tools.name],
      set: { webhookUrl },
    })
    .returning();

  // Integration token.
  const publicToken = await generatePublicToken();
  const [token] = await db
    .insert(schema.integrationTokens)
    .values({
      tenantId: tenant.id,
      publicToken,
      label: 'seeded',
      allowedOrigins: [allowedOrigin],
    })
    .returning();

  console.log('Seeded successfully:');
  console.log('  tenantId        :', tenant.id);
  console.log('  provider/model  :', provider, '/', model);
  console.log('  baseUrl         :', baseUrl ?? '(provider default)');
  console.log('  toolId          :', tool!.id);
  console.log('  webhook         :', webhookUrl);
  console.log('  signingSecret   :', tenant.webhookSigningSecret, '(set as AIVOY_WEBHOOK_SECRET)');
  console.log('  allowedOrigin   :', allowedOrigin);
  console.log('');
  console.log('  PUBLIC TOKEN    :', publicToken);
  console.log('');
  console.log('  Test:');
  console.log(`    curl -N -X POST http://localhost:3000/api/v1/chat \\`);
  console.log(`      -H "Authorization: Bearer ${publicToken}" \\`);
  console.log(`      -H "Origin: ${allowedOrigin}" \\`);
  console.log(`      -H "Content-Type: application/json" \\`);
  console.log(`      -d '{"messages":[{"role":"user","content":"hi"}]}'`);

  // Avoid console.log truncation by making sure the connection drains.
  await new Promise((r) => setTimeout(r, 50));
  process.exit(0);
}

function defaultModel(p: string): string {
  switch (p) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-sonnet-4-6';
    case 'gemini':
      return 'gemini-1.5-flash';
    case 'grok':
      return 'grok-3-mini';
    default:
      return '';
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
