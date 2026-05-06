import { eq, desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireTenant } from '@/lib/auth-gate';
import { Empty, PageHeader, Section } from '@/components/ui';
import { AddTokenForm } from './AddTokenForm';
import { TokenRow, type TokenViewModel } from './TokenRow';

export const dynamic = 'force-dynamic';

export default async function TokensPage() {
  const tenant = await requireTenant();

  const rows = await db
    .select()
    .from(schema.integrationTokens)
    .where(eq(schema.integrationTokens.tenantId, tenant.id))
    .orderBy(desc(schema.integrationTokens.createdAt));

  const tokens: TokenViewModel[] = rows.map((t) => ({
    id: t.id,
    publicToken: t.publicToken,
    label: t.label,
    allowedOrigins: t.allowedOrigins,
    monthlyMessageCap: t.monthlyMessageCap,
    revoked: !!t.revokedAt,
    lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader
        title="Integration tokens"
        description="Public tokens used by the embedded widget. Origin allowlist is enforced on every request."
      />

      <Section title="Tokens">
        {tokens.length === 0 ? (
          <Empty>No tokens yet — generate one below.</Empty>
        ) : (
          tokens.map((t) => <TokenRow key={t.id} token={t} />)
        )}
      </Section>

      <Section title="Generate token">
        <AddTokenForm />
      </Section>
    </div>
  );
}
