import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { serverEnv } from '@/lib/env';
import * as schema from './schema';

// `postgres-js` works against both local Postgres and Neon's standard wire
// endpoint, so we use the same driver in dev and prod. On Vercel, the
// connection pool is reused across warm invocations.
//
// SSL gating is by URL host, not NODE_ENV, so `pnpm dev` against a Neon URL
// still uses TLS. Local Docker on localhost gets SSL=off; everything else
// gets SSL=on.
const isLocal = /(?:localhost|127\.0\.0\.1)/.test(serverEnv.DATABASE_URL);
const isServerless = !!process.env.VERCEL;

const queryClient = postgres(serverEnv.DATABASE_URL, {
  ssl: isLocal ? false : 'require',
  // Vercel serverless: one connection per invocation; locally / long-lived
  // node servers can use a small pool.
  max: isServerless ? 1 : 10,
  prepare: false,
});

export const db = drizzle(queryClient, { schema });
export { schema };
