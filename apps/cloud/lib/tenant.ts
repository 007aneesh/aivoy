import { auth, currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';

/**
 * Resolves the current tenant for the signed-in user, creating one on first
 * visit. Personal accounts get a single-seat tenant keyed on `personal_<userId>`.
 *
 * Returns `null` only if the request is unauthenticated — callers should have
 * gone through Clerk's `auth.protect()` before this, so that's an error case.
 */
export async function getOrCreateTenant() {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  const clerkOrgId = orgId ?? `personal_${userId}`;

  const existing = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.clerkOrgId, clerkOrgId))
    .limit(1);

  if (existing[0]) return existing[0];

  const user = await currentUser();
  const name = orgId
    ? (user?.fullName ?? 'Workspace')
    : (user?.fullName ?? user?.emailAddresses[0]?.emailAddress ?? 'Personal');

  // Atomic upsert: layout + page can both run getOrCreateTenant() concurrently
  // on the first visit. ON CONFLICT DO NOTHING + RETURNING means a losing
  // racer gets an empty array back, then re-selects the winner's row.
  const inserted = await db
    .insert(schema.tenants)
    .values({
      clerkOrgId,
      clerkUserId: orgId ? null : userId,
      name,
    })
    .onConflictDoNothing({ target: schema.tenants.clerkOrgId })
    .returning();

  if (inserted[0]) return inserted[0];

  const [winner] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.clerkOrgId, clerkOrgId))
    .limit(1);

  if (!winner) {
    throw new Error('Tenant upsert lost the race but no row exists — bug?');
  }
  return winner;
}
