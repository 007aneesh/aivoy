import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, 'ok' | string> = {};

  try {
    await db.execute(sql`select 1`);
    checks.db = 'ok';
  } catch (e) {
    checks.db = e instanceof Error ? e.message : 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', checks },
    { status: allOk ? 200 : 503 },
  );
}
