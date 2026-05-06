import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { serverEnv } from '@/lib/env';
import * as schema from './schema';

// `postgres-js` works against both local Postgres and Neon's standard wire
// endpoint, so we use the same driver in dev and prod. On Vercel, the
// connection pool is reused across warm invocations.
const isProduction = process.env.NODE_ENV === 'production';

const queryClient = postgres(serverEnv.DATABASE_URL, {
  ssl: isProduction ? 'require' : false,
  max: isProduction ? 1 : 10,
  prepare: false,
});

export const db = drizzle(queryClient, { schema });
export { schema };
