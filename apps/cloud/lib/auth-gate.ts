import { auth } from '@clerk/nextjs/server';
import type { Tenant } from '@/db/schema';
import { getOrCreateTenant } from './tenant';

/**
 * For server actions and route handlers: returns the active tenant or throws.
 * Use this at the top of every mutation, then scope all queries by tenant.id.
 */
export async function requireTenant(): Promise<Tenant> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  const tenant = await getOrCreateTenant();
  if (!tenant) throw new Error('Unauthorized');
  return tenant;
}
