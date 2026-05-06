'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { generatePublicToken } from '@/lib/crypto';
import { requireTenant } from '@/lib/auth-gate';
import { serverEnv } from '@/lib/env';

const Schema = z.object({
  label: z.string().trim().min(1).max(60),
  allowedOrigins: z
    .string()
    .trim()
    .transform((s) =>
      s
        .split(/[\s,]+/)
        .map((o) => o.trim())
        .filter(Boolean),
    )
    .refine((arr) => arr.every((o) => /^https?:\/\//.test(o)), {
      message: 'Each origin must include http:// or https://',
    }),
  monthlyCap: z
    .string()
    .trim()
    .transform((s) => (s === '' ? null : Number(s)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), {
      message: 'Monthly cap must be a positive integer (or empty for unlimited)',
    }),
});

export async function createToken(formData: FormData) {
  const tenant = await requireTenant();
  const parsed = Schema.parse({
    label: formData.get('label'),
    allowedOrigins: formData.get('allowedOrigins'),
    monthlyCap: formData.get('monthlyCap'),
  });

  const publicToken = await generatePublicToken();

  // Always allow the dashboard's own origin so the in-dashboard Playground works
  // without the user having to remember to add it.
  const dashboardOrigin = new URL(serverEnv.NEXT_PUBLIC_APP_URL).origin;
  const allowedOrigins = parsed.allowedOrigins.includes(dashboardOrigin)
    ? parsed.allowedOrigins
    : [...parsed.allowedOrigins, dashboardOrigin];

  await db.insert(schema.integrationTokens).values({
    tenantId: tenant.id,
    publicToken,
    label: parsed.label,
    allowedOrigins,
    monthlyMessageCap: parsed.monthlyCap,
  });

  revalidatePath('/dashboard/tokens');
}

export async function revokeToken(formData: FormData) {
  const tenant = await requireTenant();
  const id = z.string().uuid().parse(formData.get('id'));

  await db
    .update(schema.integrationTokens)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(schema.integrationTokens.id, id),
        eq(schema.integrationTokens.tenantId, tenant.id),
      ),
    );

  revalidatePath('/dashboard/tokens');
}

export async function deleteToken(formData: FormData) {
  const tenant = await requireTenant();
  const id = z.string().uuid().parse(formData.get('id'));

  await db
    .delete(schema.integrationTokens)
    .where(
      and(
        eq(schema.integrationTokens.id, id),
        eq(schema.integrationTokens.tenantId, tenant.id),
      ),
    );

  revalidatePath('/dashboard/tokens');
}
