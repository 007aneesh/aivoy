import { eq, asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireTenant } from '@/lib/auth-gate';
import { PageHeader, Section } from '@/components/ui';
import { AssistantForm } from './AssistantForm';

export const dynamic = 'force-dynamic';

export default async function AssistantPage() {
  const tenant = await requireTenant();

  const [assistant] = await db
    .select()
    .from(schema.assistants)
    .where(eq(schema.assistants.tenantId, tenant.id))
    .limit(1);

  const providers = await db
    .select({
      id: schema.providerCredentials.id,
      label: schema.providerCredentials.label,
      provider: schema.providerCredentials.provider,
      model: schema.providerCredentials.model,
    })
    .from(schema.providerCredentials)
    .where(eq(schema.providerCredentials.tenantId, tenant.id))
    .orderBy(asc(schema.providerCredentials.label));

  return (
    <div>
      <PageHeader
        title="Assistant"
        description="Identity, greeting, and which provider answers messages."
      />

      <Section title="Configuration">
        <AssistantForm
          initial={
            assistant
              ? {
                  name: assistant.name,
                  greeting: assistant.greeting,
                  systemPrompt: assistant.systemPrompt,
                  suggestedPrompts: assistant.suggestedPrompts ?? [],
                  providerCredentialId: assistant.providerCredentialId,
                  avatarUrl: assistant.avatarUrl,
                  theme: assistant.theme as Record<string, unknown> | null,
                }
              : null
          }
          providers={providers}
        />
      </Section>
    </div>
  );
}
