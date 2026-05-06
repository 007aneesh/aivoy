import { eq, desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { requireTenant } from '@/lib/auth-gate';
import { Badge, Button, Empty, PageHeader, Row, Section } from '@/components/ui';
import { AddProviderForm } from './AddProviderForm';
import { deleteProvider } from './actions';

export const dynamic = 'force-dynamic';

export default async function ProvidersPage() {
  const tenant = await requireTenant();

  const rows = await db
    .select()
    .from(schema.providerCredentials)
    .where(eq(schema.providerCredentials.tenantId, tenant.id))
    .orderBy(desc(schema.providerCredentials.createdAt));

  return (
    <div>
      <PageHeader
        title="Providers"
        description="LLM credentials. Keys are encrypted at rest with AES-256-GCM and never re-displayed."
      />

      <Section title="Configured providers">
        {rows.length === 0 ? (
          <Empty>No providers yet — add one below.</Empty>
        ) : (
          rows.map((p) => {
            const isGroqStyle = p.baseUrl?.includes('api.groq.com');
            const isXaiStyle = p.baseUrl?.includes('api.x.ai');
            const display = isGroqStyle
              ? 'Groq'
              : isXaiStyle
                ? 'Grok (xAI)'
                : prettyProvider(p.provider);
            return (
              <Row key={p.id}>
                <div>
                  <div style={{ fontWeight: 600 }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    <Badge>{display}</Badge>{' '}
                    <code style={{ fontSize: 11 }}>{p.model}</code>
                    {p.baseUrl && (
                      <>
                        {' • '}
                        <span>{p.baseUrl}</span>
                      </>
                    )}
                  </div>
                </div>
                <form action={deleteProvider}>
                  <input type="hidden" name="id" value={p.id} />
                  <Button variant="danger">Delete</Button>
                </form>
              </Row>
            );
          })
        )}
      </Section>

      <Section
        title="Add provider"
        description="OpenAI, Anthropic, and Gemini call their official endpoints. Grok and Groq are OpenAI-compatible — they reuse the OpenAI runner with a different base URL."
      >
        <AddProviderForm />
      </Section>
    </div>
  );
}

function prettyProvider(p: string): string {
  switch (p) {
    case 'openai':
      return 'OpenAI';
    case 'anthropic':
      return 'Anthropic';
    case 'gemini':
      return 'Gemini';
    case 'grok':
      return 'Grok';
    default:
      return p;
  }
}
