import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Each Clerk org maps 1:1 to a tenant. Personal users get a single-seat tenant
 * created lazily on their first dashboard visit.
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clerkOrgId: text('clerk_org_id').notNull(),
    clerkUserId: text('clerk_user_id'),
    name: text('name').notNull(),
    plan: text('plan').notNull().default('free'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    clerkOrgIdx: uniqueIndex('tenants_clerk_org_idx').on(t.clerkOrgId),
  }),
);

/**
 * A provider's name on the wire. `grok` reuses the OpenAI adapter under the
 * hood with `baseUrl` set to xAI; we store it separately so the dashboard
 * picker matches the user's mental model.
 */
export const providerEnum = pgEnum('provider', [
  'openai',
  'anthropic',
  'gemini',
  'grok',
]);

export const providerCredentials = pgTable(
  'provider_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    provider: providerEnum('provider').notNull(),
    label: text('label').notNull(),
    /** sealed by libsodium secretbox — decrypted only on the chat hot path. */
    encryptedKey: text('encrypted_key').notNull(),
    /** non-secret — model id (e.g. gpt-4o-mini, claude-sonnet-4-6, grok-3). */
    model: text('model').notNull(),
    /** non-secret — optional override of the provider's base URL. */
    baseUrl: text('base_url'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantIdx: index('provider_credentials_tenant_idx').on(t.tenantId),
  }),
);

/**
 * The user-facing assistant config — name, greeting, theme, suggested prompts.
 * One per tenant for v1; we'll multi-instance later.
 */
export const assistants = pgTable(
  'assistants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('Assistant'),
    avatarUrl: text('avatar_url'),
    greeting: text('greeting'),
    suggestedPrompts: jsonb('suggested_prompts').$type<string[]>().default([]),
    systemPrompt: text('system_prompt'),
    /** { accent, radius, position, mode } — all optional. */
    theme: jsonb('theme').$type<Record<string, unknown>>().default({}),
    /** Which provider_credentials row to use. */
    providerCredentialId: uuid('provider_credential_id').references(
      () => providerCredentials.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantIdx: uniqueIndex('assistants_tenant_idx').on(t.tenantId),
  }),
);

/**
 * Tools-as-webhooks. The LLM gets the JSON schema; on a tool_call we POST
 * { name, args, ctx } to webhookUrl with an HMAC signature derived from
 * webhookSecret, then feed the response back into the stream.
 */
export const tools = pgTable(
  'tools',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull(),
    webhookUrl: text('webhook_url').notNull(),
    /** Tenant-managed shared secret for HMAC signing. Stored plaintext —
     * it is essentially a webhook auth credential, not user data. */
    webhookSecret: text('webhook_secret').notNull(),
    /** JSON Schema for the tool's input. Validated against the LLM's call
     * server-side before invoking the webhook. */
    inputSchema: jsonb('input_schema').$type<Record<string, unknown>>().notNull(),
    /** Optional: render the tool result as a card type in the widget. */
    renderAs: text('render_as'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantNameIdx: uniqueIndex('tools_tenant_name_idx').on(t.tenantId, t.name),
  }),
);

/**
 * Public tokens used by the embedded widget. The `publicToken` is what ends
 * up in client code (prefixed `pk_`). `allowedOrigins` is enforced by the
 * chat route — requests from other Origins are rejected.
 */
export const integrationTokens = pgTable(
  'integration_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    publicToken: text('public_token').notNull(),
    label: text('label').notNull().default('default'),
    allowedOrigins: jsonb('allowed_origins').$type<string[]>().notNull().default([]),
    monthlyMessageCap: integer('monthly_message_cap'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    publicTokenIdx: uniqueIndex('integration_tokens_public_idx').on(
      t.publicToken,
    ),
    tenantIdx: index('integration_tokens_tenant_idx').on(t.tenantId),
  }),
);

/**
 * One row per completed turn (tracked at message_received time). Aggregations
 * for the dashboard run off this table.
 */
export const usageEvents = pgTable(
  'usage_events',
  {
    id: bigint('id', { mode: 'bigint' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    tokenId: uuid('token_id')
      .notNull()
      .references(() => integrationTokens.id, { onDelete: 'cascade' }),
    provider: providerEnum('provider').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    /** Cents × 1000 (so 1 = $0.00001). Optional — set when we know rates. */
    costMicroCents: bigint('cost_micro_cents', { mode: 'bigint' }),
    toolCallCount: integer('tool_call_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantTimeIdx: index('usage_events_tenant_time_idx').on(
      t.tenantId,
      t.createdAt,
    ),
    tokenTimeIdx: index('usage_events_token_time_idx').on(
      t.tokenId,
      t.createdAt,
    ),
  }),
);

// Row helpers for the type-safe selects in the rest of the app.
export type Tenant = typeof tenants.$inferSelect;
export type ProviderCredential = typeof providerCredentials.$inferSelect;
export type Assistant = typeof assistants.$inferSelect;
export type Tool = typeof tools.$inferSelect;
export type IntegrationToken = typeof integrationTokens.$inferSelect;
export type UsageEvent = typeof usageEvents.$inferSelect;

export const _migrationGuard = sql`-- intentionally empty`;
