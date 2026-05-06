import { getOrCreateTenant } from '@/lib/tenant';

export default async function DashboardPage() {
  const tenant = await getOrCreateTenant();
  if (!tenant) return null;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Welcome to {tenant.name}</h1>
      <p style={{ color: 'var(--muted)' }}>
        Set up your concierge in three steps.
      </p>

      <ol style={{ paddingLeft: 20, marginTop: 24, lineHeight: 2 }}>
        <li>
          <a href="/dashboard/providers">Add a provider</a> — choose OpenAI,
          Anthropic, Gemini, or Grok and paste your API key.
        </li>
        <li>
          <a href="/dashboard/tools">Register tools</a> — give the assistant
          live access to your data via webhooks.
        </li>
        <li>
          <a href="/dashboard/tokens">Generate a token</a> — paste the
          embed snippet into your site.
        </li>
      </ol>

      <p style={{ marginTop: 32, color: 'var(--muted)', fontSize: 13 }}>
        Tenant ID:{' '}
        <code style={{ fontSize: 12 }}>{tenant.id}</code>
      </p>
    </div>
  );
}
