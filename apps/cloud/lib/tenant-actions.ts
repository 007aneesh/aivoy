'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { generateWebhookSecret } from '@/lib/crypto';
import { requireTenant } from '@/lib/auth-gate';

/**
 * Rotates the tenant's single webhook signing secret. The new value is
 * returned; nothing else is. Subsequent webhook calls will be signed with
 * the new secret immediately, so the tenant must update the AIVOY_WEBHOOK_SECRET
 * env var on their server (or any other consumer) before re-enabling traffic.
 */
export async function rotateWebhookSigningSecret(): Promise<{ secret: string }> {
  const tenant = await requireTenant();
  const next = await generateWebhookSecret();
  await db
    .update(schema.tenants)
    .set({ webhookSigningSecret: next })
    .where(eq(schema.tenants.id, tenant.id));
  revalidatePath('/dashboard/tools');
  return { secret: next };
}
