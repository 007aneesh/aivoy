import { eq, desc, isNull, and } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireTenant } from '@/lib/auth-gate';
import { PageHeader, Section } from '@/components/ui';
import { Playground } from './Playground';

export const dynamic = 'force-dynamic';

export default async function PlaygroundPage() {
  const tenant = await requireTenant();

  // Use the most-recent active token for in-dashboard testing. The dashboard
  // origin is automatically allowed via the token row (we set it below).
  const [token] = await db
    .select()
    .from(schema.integrationTokens)
    .where(
      and(
        eq(schema.integrationTokens.tenantId, tenant.id),
        isNull(schema.integrationTokens.revokedAt),
      ),
    )
    .orderBy(desc(schema.integrationTokens.createdAt))
    .limit(1);

  return (
    <div>
      <PageHeader
        title="Playground"
        description="Live test of /embed/v1/chat using your most recent active token."
      />

      {!token ? (
        <Section title="No active token">
          <div style={{ padding: 24, color: 'var(--muted)' }}>
            Generate one in <a href="/dashboard/tokens">Tokens</a> first.
          </div>
        </Section>
      ) : (
        <Section
          title="Chat"
          description={`Sending as ${token.label} • token ${token.publicToken.slice(0, 12)}…`}
        >
          <Playground publicToken={token.publicToken} />
        </Section>
      )}
    </div>
  );
}
