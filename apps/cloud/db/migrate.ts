// Load .env files the same way Next.js does — .env.local overrides .env, with
// .env.{NODE_ENV}.local on top of that. dotenv preserves the first-set value
// of each var (it never overwrites), so order matters here: most specific first.
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: `.env.${process.env.NODE_ENV ?? 'development'}.local` });
config({ path: '.env' });

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Either add it to apps/cloud/.env.local, or pass it inline:\n' +
        "  DATABASE_URL='postgres://…' pnpm --filter @aivoy/cloud db:migrate",
    );
  }

  // Use SSL when the URL points at a remote host (Neon, Supabase, etc.) and
  // skip it for local Docker. Detect by hostname rather than NODE_ENV so a
  // dev terminal pointed at prod Neon still uses SSL.
  const isLocal = /(?:localhost|127\.0\.0\.1)/.test(url);

  console.log(`Migrating ${isLocal ? 'LOCAL' : 'REMOTE'} database…`);
  console.log(`  ${redact(url)}`);

  const sql = postgres(url, {
    max: 1,
    ssl: isLocal ? false : 'require',
  });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: './db/migrations' });
  await sql.end();
  console.log('Done.');
}

function redact(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '<malformed url>';
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
