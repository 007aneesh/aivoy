import { eq, asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireTenant } from '@/lib/auth-gate';
import { Empty, PageHeader, Section } from '@/components/ui';
import { ToolForm } from './ToolForm';
import { ToolRow, type ToolViewModel } from './ToolRow';
import { WebhookSecretPanel } from './WebhookSecretPanel';

export const dynamic = 'force-dynamic';

export default async function ToolsPage() {
  const tenant = await requireTenant();

  const rows = await db
    .select()
    .from(schema.tools)
    .where(eq(schema.tools.tenantId, tenant.id))
    .orderBy(asc(schema.tools.name));

  const tools: ToolViewModel[] = rows.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    webhookUrl: t.webhookUrl,
    inputSchema: t.inputSchema,
    renderAs: t.renderAs,
    enabled: t.enabled,
  }));

  return (
    <div>
      <PageHeader
        title="Tools"
        description="When the LLM calls a tool, aivoy POSTs the args to your webhook (HMAC-SHA256 signed). Whatever JSON you return is fed back into the conversation."
      />

      <Section
        title="Webhook signing secret"
        description="One secret for every tool below. Adding a new tool requires zero new env vars on your server."
      >
        <WebhookSecretPanel initial={tenant.webhookSigningSecret} />
      </Section>

      <Section title="Configured tools">
        {tools.length === 0 ? (
          <Empty>No tools yet — add one below.</Empty>
        ) : (
          tools.map((t) => <ToolRow key={t.id} tool={t} />)
        )}
      </Section>

      <Section title="Add tool">
        <ToolForm />
      </Section>
    </div>
  );
}
