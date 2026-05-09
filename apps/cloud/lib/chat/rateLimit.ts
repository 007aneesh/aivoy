import { and, eq, gte, sql } from 'drizzle-orm';
import { db, schema } from '@/db';

export interface RateLimitResult {
  /** True if this request would push the token over its monthly cap. */
  exceeded: boolean;
  /** Cap value (null = unlimited). */
  cap: number | null;
  /** How many messages the token has already used this calendar month. */
  used: number;
  /** Remaining for the period. `Infinity` when cap is null. */
  remaining: number;
  /** Unix seconds at which the count resets (start of next month, UTC). */
  resetAt: number;
}

/**
 * Counts the messages a token has consumed this calendar month and reports
 * whether the next request would breach the cap. We count every successful
 * turn — a turn is one row in `usage_events`. Rejected requests don't insert,
 * so they don't burn quota.
 *
 * Note: race-y — two requests at the cap edge could both succeed. Acceptable
 * for the v1 of pricing-soft-limits; can move to Redis/atomic counters later.
 */
export async function checkTokenRateLimit(
  tokenId: string,
  tenantId: string,
  cap: number | null,
): Promise<RateLimitResult> {
  const resetAt = Math.floor(startOfNextMonthUtc().getTime() / 1000);

  if (cap == null) {
    return { exceeded: false, cap: null, used: 0, remaining: Infinity, resetAt };
  }

  const startOfMonth = sql`date_trunc('month', now())`;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.usageEvents)
    .where(
      and(
        eq(schema.usageEvents.tokenId, tokenId),
        eq(schema.usageEvents.tenantId, tenantId),
        gte(schema.usageEvents.createdAt, startOfMonth),
      ),
    );

  const used = row?.count ?? 0;
  const remaining = Math.max(0, cap - used);
  return {
    exceeded: used >= cap,
    cap,
    used,
    remaining,
    resetAt,
  };
}

function startOfNextMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export interface TokenBudgetResult {
  exceeded: boolean;
  cap: number | null;
  used: number;
  remaining: number;
  /** Unix seconds at which the count resets (start of next UTC day). */
  resetAt: number;
}

/**
 * Sums input+output tokens spent today (UTC) and reports whether the *next*
 * turn would exceed the daily cap. A turn that hasn't started yet costs ≥1
 * token, so we treat used >= cap as exceeded. Same race-y caveat as the
 * monthly counter.
 */
export async function checkTokenDailyBudget(
  tokenId: string,
  tenantId: string,
  cap: number | null,
): Promise<TokenBudgetResult> {
  const resetAt = Math.floor(startOfNextDayUtc().getTime() / 1000);

  if (cap == null) {
    return { exceeded: false, cap: null, used: 0, remaining: Infinity, resetAt };
  }

  const startOfDay = sql`date_trunc('day', now() at time zone 'utc')`;
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.usageEvents.inputTokens} + ${schema.usageEvents.outputTokens}), 0)::int`,
    })
    .from(schema.usageEvents)
    .where(
      and(
        eq(schema.usageEvents.tokenId, tokenId),
        eq(schema.usageEvents.tenantId, tenantId),
        gte(schema.usageEvents.createdAt, startOfDay),
      ),
    );

  const used = row?.total ?? 0;
  const remaining = Math.max(0, cap - used);
  return { exceeded: used >= cap, cap, used, remaining, resetAt };
}

function startOfNextDayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
}
