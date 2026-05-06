import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';

export interface UsageSummary {
  thisMonth: {
    messages: number;
    inputTokens: number;
    outputTokens: number;
    toolCalls: number;
  };
  last30Days: {
    /** ISO date (yyyy-mm-dd, UTC) → message count. Sorted oldest → newest. */
    series: Array<{ date: string; messages: number; tokens: number }>;
  };
}

export interface TokenUsageRow {
  tokenId: string;
  label: string;
  publicTokenSuffix: string;
  cap: number | null;
  thisMonth: number;
  lastUsedAt: string | null;
  revoked: boolean;
}

export interface RecentEvent {
  id: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  toolCallCount: number;
  createdAt: string;
  tokenLabel: string;
}

export async function loadUsage(tenantId: string): Promise<{
  summary: UsageSummary;
  perToken: TokenUsageRow[];
  recent: RecentEvent[];
}> {
  const startOfMonth = sql`date_trunc('month', now())`;
  const thirtyDaysAgo = sql`now() - interval '30 days'`;

  // Summary totals for this month.
  const [totals] = await db
    .select({
      messages: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${schema.usageEvents.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${schema.usageEvents.outputTokens}), 0)::int`,
      toolCalls: sql<number>`coalesce(sum(${schema.usageEvents.toolCallCount}), 0)::int`,
    })
    .from(schema.usageEvents)
    .where(
      and(
        eq(schema.usageEvents.tenantId, tenantId),
        gte(schema.usageEvents.createdAt, startOfMonth),
      ),
    );

  // 30-day daily counts.
  const dailyRows = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${schema.usageEvents.createdAt}), 'YYYY-MM-DD')`,
      messages: sql<number>`count(*)::int`,
      tokens: sql<number>`coalesce(sum(${schema.usageEvents.inputTokens} + ${schema.usageEvents.outputTokens}), 0)::int`,
    })
    .from(schema.usageEvents)
    .where(
      and(
        eq(schema.usageEvents.tenantId, tenantId),
        gte(schema.usageEvents.createdAt, thirtyDaysAgo),
      ),
    )
    .groupBy(sql`date_trunc('day', ${schema.usageEvents.createdAt})`)
    .orderBy(sql`date_trunc('day', ${schema.usageEvents.createdAt})`);

  // Backfill missing days as zeroes — chart looks better.
  const series: UsageSummary['last30Days']['series'] = [];
  const byDate = new Map(dailyRows.map((r) => [r.date, r]));
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const row = byDate.get(iso);
    series.push({ date: iso, messages: row?.messages ?? 0, tokens: row?.tokens ?? 0 });
  }

  // Per-token usage this month — left join so tokens with 0 messages still appear.
  const perToken = await db
    .select({
      tokenId: schema.integrationTokens.id,
      label: schema.integrationTokens.label,
      publicToken: schema.integrationTokens.publicToken,
      cap: schema.integrationTokens.monthlyMessageCap,
      revokedAt: schema.integrationTokens.revokedAt,
      lastUsedAt: schema.integrationTokens.lastUsedAt,
      messages: sql<number>`coalesce(count(${schema.usageEvents.id}) filter (where ${schema.usageEvents.createdAt} >= ${startOfMonth}), 0)::int`,
    })
    .from(schema.integrationTokens)
    .leftJoin(
      schema.usageEvents,
      eq(schema.usageEvents.tokenId, schema.integrationTokens.id),
    )
    .where(eq(schema.integrationTokens.tenantId, tenantId))
    .groupBy(schema.integrationTokens.id)
    .orderBy(desc(schema.integrationTokens.createdAt));

  // Recent events (last 20).
  const recent = await db
    .select({
      id: schema.usageEvents.id,
      provider: schema.usageEvents.provider,
      model: schema.usageEvents.model,
      inputTokens: schema.usageEvents.inputTokens,
      outputTokens: schema.usageEvents.outputTokens,
      toolCallCount: schema.usageEvents.toolCallCount,
      createdAt: schema.usageEvents.createdAt,
      tokenLabel: schema.integrationTokens.label,
    })
    .from(schema.usageEvents)
    .leftJoin(
      schema.integrationTokens,
      eq(schema.usageEvents.tokenId, schema.integrationTokens.id),
    )
    .where(eq(schema.usageEvents.tenantId, tenantId))
    .orderBy(desc(schema.usageEvents.id))
    .limit(20);

  return {
    summary: {
      thisMonth: totals ?? { messages: 0, inputTokens: 0, outputTokens: 0, toolCalls: 0 },
      last30Days: { series },
    },
    perToken: perToken.map((p) => ({
      tokenId: p.tokenId,
      label: p.label,
      publicTokenSuffix: p.publicToken.slice(-6),
      cap: p.cap,
      thisMonth: p.messages,
      lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
      revoked: !!p.revokedAt,
    })),
    recent: recent.map((r) => ({
      id: r.id.toString(),
      provider: r.provider,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      toolCallCount: r.toolCallCount,
      createdAt: r.createdAt.toISOString(),
      tokenLabel: r.tokenLabel ?? '(deleted)',
    })),
  };
}
