import Link from 'next/link';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getOrCreateTenant } from '@/lib/tenant';

export default async function DashboardPage() {
  const tenant = await getOrCreateTenant();
  if (!tenant) return null;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    [providerRow],
    [assistantRow],
    [toolCount],
    [tokenCount],
    [{ messages24h, inputTokens24h, outputTokens24h, toolCalls24h }],
    [{ messages7d }],
    recentTokens,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(schema.providerCredentials)
      .where(eq(schema.providerCredentials.tenantId, tenant.id))
      .limit(1),
    db
      .select({
        name: schema.assistants.name,
        providerCredentialId: schema.assistants.providerCredentialId,
        systemPrompt: schema.assistants.systemPrompt,
      })
      .from(schema.assistants)
      .where(eq(schema.assistants.tenantId, tenant.id))
      .limit(1),
    db
      .select({ count: count() })
      .from(schema.tools)
      .where(and(eq(schema.tools.tenantId, tenant.id), eq(schema.tools.enabled, true))),
    db
      .select({ count: count() })
      .from(schema.integrationTokens)
      .where(eq(schema.integrationTokens.tenantId, tenant.id)),
    db
      .select({
        messages24h: count(),
        inputTokens24h: sql<number>`coalesce(sum(${schema.usageEvents.inputTokens}),0)::int`,
        outputTokens24h: sql<number>`coalesce(sum(${schema.usageEvents.outputTokens}),0)::int`,
        toolCalls24h: sql<number>`coalesce(sum(${schema.usageEvents.toolCallCount}),0)::int`,
      })
      .from(schema.usageEvents)
      .where(and(eq(schema.usageEvents.tenantId, tenant.id), gte(schema.usageEvents.createdAt, since24h))),
    db
      .select({ messages7d: count() })
      .from(schema.usageEvents)
      .where(and(eq(schema.usageEvents.tenantId, tenant.id), gte(schema.usageEvents.createdAt, since7d))),
    db
      .select({
        id: schema.integrationTokens.id,
        label: schema.integrationTokens.label,
        publicToken: schema.integrationTokens.publicToken,
        lastUsedAt: schema.integrationTokens.lastUsedAt,
        revokedAt: schema.integrationTokens.revokedAt,
      })
      .from(schema.integrationTokens)
      .where(eq(schema.integrationTokens.tenantId, tenant.id))
      .orderBy(desc(schema.integrationTokens.createdAt))
      .limit(3),
  ]);

  const hasProvider = (providerRow?.count ?? 0) > 0;
  const hasAssistantConfigured = !!assistantRow?.providerCredentialId;
  const hasTool = (toolCount?.count ?? 0) > 0;
  const hasToken = (tokenCount?.count ?? 0) > 0;
  const isLive = hasProvider && hasAssistantConfigured && hasToken;
  const stepsDone = [hasProvider, hasAssistantConfigured, hasToken].filter(Boolean).length;
  const totalSteps = 3;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <header className="row-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span className={`pill ${isLive ? 'pill-success' : 'pill-warning'}`}>
            {isLive ? '● Live' : `${stepsDone} / ${totalSteps} setup`}
          </span>
          <h1 style={{ marginTop: 8 }}>{tenant.name}</h1>
          <p className="muted text-sm" style={{ marginTop: 4 }}>
            {isLive
              ? 'Your concierge is ready. Embed the snippet on your site to go live.'
              : 'Finish the steps below to take your concierge live.'}
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link href="/dashboard/playground" className="btn btn-secondary">Playground</Link>
          <Link href="/dashboard/tokens" className="btn btn-primary">Get embed snippet →</Link>
        </div>
      </header>

      <Stat row={[
        { label: 'Messages (24h)', value: messages24h ?? 0 },
        { label: 'Tool calls (24h)', value: toolCalls24h ?? 0 },
        { label: 'Tokens in / out (24h)', value: `${formatNum(inputTokens24h ?? 0)} / ${formatNum(outputTokens24h ?? 0)}` },
        { label: 'Messages (7d)', value: messages7d ?? 0 },
      ]} />

      <section className="card card-flush">
        <div className="card-header row-between">
          <h2 style={{ fontSize: 14 }}>Setup checklist</h2>
          <span className="muted text-xs">{stepsDone} / {totalSteps}</span>
        </div>
        <ChecklistItem
          done={hasProvider}
          title="Connect an LLM provider"
          subtitle={hasProvider ? 'Provider key stored.' : 'Bring your OpenAI / Anthropic / Gemini / Grok / Groq key.'}
          href="/dashboard/providers"
          cta={hasProvider ? 'Manage' : 'Add provider'}
        />
        <ChecklistItem
          done={hasAssistantConfigured}
          title="Configure the assistant"
          subtitle={
            hasAssistantConfigured
              ? `${assistantRow?.name ?? 'Assistant'} — ${assistantRow?.systemPrompt ? 'system prompt set.' : 'using defaults.'}`
              : 'Pick a provider for the assistant, name, greeting, system prompt.'
          }
          href="/dashboard/assistant"
          cta={hasAssistantConfigured ? 'Edit' : 'Configure'}
        />
        <ChecklistItem
          done={hasTool}
          title="Register tools"
          subtitle={
            hasTool
              ? `${toolCount?.count} tool${toolCount?.count === 1 ? '' : 's'} enabled.`
              : 'Optional — but the assistant is far more useful with live data.'
          }
          href="/dashboard/tools"
          cta={hasTool ? 'Manage' : 'Add tool'}
          optional
        />
        <ChecklistItem
          done={hasToken}
          title="Generate an embed token"
          subtitle={hasToken ? `${tokenCount?.count} token${tokenCount?.count === 1 ? '' : 's'} created.` : 'Public token for the widget — set allowed origins.'}
          href="/dashboard/tokens"
          cta={hasToken ? 'Manage' : 'Generate token'}
          last
        />
      </section>

      <div className="row" style={{ gap: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <section className="card" style={{ flex: '1 1 320px' }}>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 14 }}>Recent tokens</h2>
            <Link href="/dashboard/tokens" className="text-xs muted">All →</Link>
          </div>
          {recentTokens.length === 0 ? (
            <p className="muted text-sm" style={{ margin: 0 }}>No tokens yet. Generate one to embed the widget.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {recentTokens.map((t) => (
                <li
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderTop: '1px solid var(--border)',
                    gap: 8,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="text-sm" style={{ fontWeight: 500 }}>{t.label || 'Untitled'}</span>
                      {t.revokedAt ? (
                        <span className="pill pill-danger">revoked</span>
                      ) : (
                        <span className="pill pill-success">active</span>
                      )}
                    </div>
                    <div className="text-xs muted" style={{ marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                      {t.publicToken.slice(0, 16)}…
                    </div>
                  </div>
                  <span className="text-xs muted">
                    {t.lastUsedAt ? `used ${relativeTime(t.lastUsedAt)}` : 'unused'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" style={{ flex: '1 1 320px' }}>
          <h2 style={{ fontSize: 14, marginBottom: 12 }}>Quick links</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <QuickLink href="/dashboard/playground" title="Playground" desc="Send a test message through your live config." />
            <QuickLink href="/dashboard/usage" title="Usage" desc="Token spend and cost over time." />
            <QuickLink href="/docs#build-webhook" title="Build a tool webhook" desc="Express, Next.js, FastAPI snippets." external />
            <QuickLink href="/docs#cards" title="Custom cards" desc="Render tool results in your own UI." external />
          </ul>
        </section>
      </div>

      <p className="muted text-xs">
        Tenant ID <code className="code">{tenant.id}</code>
      </p>
    </div>
  );
}

function Stat({ row }: { row: { label: string; value: number | string }[] }) {
  return (
    <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
      {row.map((item) => (
        <div key={item.label} className="card" style={{ flex: '1 1 160px', padding: 16 }}>
          <div className="text-xs muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>
            {item.label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6 }}>
            {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChecklistItem({
  done,
  title,
  subtitle,
  href,
  cta,
  optional,
  last,
}: {
  done: boolean;
  title: string;
  subtitle: string;
  href: string;
  cta: string;
  optional?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className="row-between"
      style={{
        padding: '14px 20px',
        borderTop: '1px solid var(--border)',
        borderBottom: last ? 'none' : undefined,
        gap: 12,
      }}
    >
      <div className="row" style={{ gap: 12, minWidth: 0 }}>
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            width: 22,
            height: 22,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            background: done ? 'var(--success-soft)' : 'var(--bg-hover)',
            color: done ? 'var(--success)' : 'var(--muted)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {done ? '✓' : ''}
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 6 }}>
            <span className="text-sm" style={{ fontWeight: 500 }}>{title}</span>
            {optional && <span className="pill text-xs">optional</span>}
          </div>
          <div className="text-xs muted" style={{ marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>
      <Link href={href} className={`btn btn-sm ${done ? 'btn-secondary' : 'btn-primary'}`}>
        {cta}
      </Link>
    </div>
  );
}

function QuickLink({ href, title, desc, external }: { href: string; title: string; desc: string; external?: boolean }) {
  return (
    <li>
      <Link
        href={href}
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '10px 12px',
          borderRadius: 'var(--radius)',
          color: 'inherit',
          textDecoration: 'none',
          transition: 'background-color 120ms',
        }}
        className="quicklink"
      >
        <span className="text-sm" style={{ fontWeight: 500 }}>
          {title} {external && <span className="muted text-xs">↗</span>}
        </span>
        <span className="text-xs muted" style={{ marginTop: 2 }}>{desc}</span>
      </Link>
    </li>
  );
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function relativeTime(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(d).toLocaleDateString();
}
