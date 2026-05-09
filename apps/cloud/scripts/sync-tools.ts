/**
 * Pull the live tool registry from a cas-style host (any aivoy-tooled API)
 * and overwrite the cloud DB tool rows for a given tenant. Keeps the
 * LLM-visible JSON Schema in lockstep with the handler's zod schema —
 * fixes the drift class that bit us when `maxPrice` was missing from the
 * cloud row but present in the cas zod schema.
 *
 * Usage:
 *   pnpm --filter @aivoy/cloud exec tsx scripts/sync-tools.ts \
 *     --tenant <tenantId> \
 *     --registry http://localhost:3001/api/v1/aivoy \
 *     --webhook-base http://localhost:3001/api/v1/aivoy/tools
 *
 * Reads the GET /aivoy registry endpoint (must return
 *   { tools: [{ name, description, renderAs, parameters }] })
 * and upserts each tool into the cloud `tools` table for the given tenant,
 * with `webhookUrl = <webhook-base>/<name>`.
 */
import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db';

interface RemoteTool {
  name: string;
  description: string;
  renderAs?: string | null;
  parameters?: Record<string, unknown>;
}

interface Args {
  tenantId: string;
  registryUrl: string;
  webhookBase: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const tenantId = get('--tenant') ?? process.env.SYNC_TENANT_ID;
  const registryUrl =
    get('--registry') ?? process.env.SYNC_REGISTRY_URL ?? 'http://localhost:3001/api/v1/aivoy';
  const webhookBase =
    get('--webhook-base') ??
    process.env.SYNC_WEBHOOK_BASE ??
    `${registryUrl.replace(/\/$/, '')}/tools`;
  if (!tenantId) {
    console.error(
      'Missing --tenant <tenantId>. Pass via flag or SYNC_TENANT_ID env var.',
    );
    process.exit(1);
  }
  return { tenantId, registryUrl, webhookBase };
}

async function main() {
  const { tenantId, registryUrl, webhookBase } = parseArgs();

  const res = await fetch(registryUrl, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    console.error(`registry fetch failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const body = (await res.json()) as { tools?: RemoteTool[] };
  const remote = body.tools ?? [];
  if (remote.length === 0) {
    console.error('registry returned no tools — nothing to sync');
    process.exit(1);
  }

  // Verify tenant exists; refuse to silently no-op on a typo.
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);
  if (!tenant) {
    console.error(`tenant not found: ${tenantId}`);
    process.exit(1);
  }

  const existing = await db
    .select()
    .from(schema.tools)
    .where(eq(schema.tools.tenantId, tenantId));
  const existingByName = new Map(existing.map((t) => [t.name, t]));

  const summary: { upserted: string[]; orphaned: string[] } = {
    upserted: [],
    orphaned: [],
  };

  for (const t of remote) {
    const webhookUrl = `${webhookBase.replace(/\/$/, '')}/${encodeURIComponent(t.name)}`;
    const inputSchema = t.parameters ?? { type: 'object', properties: {} };
    const renderAs = t.renderAs ?? null;
    const description = t.description ?? '';
    const prior = existingByName.get(t.name);
    if (prior) {
      await db
        .update(schema.tools)
        .set({ description, inputSchema, renderAs, webhookUrl, enabled: true })
        .where(and(eq(schema.tools.id, prior.id), eq(schema.tools.tenantId, tenantId)));
    } else {
      await db.insert(schema.tools).values({
        tenantId,
        name: t.name,
        description,
        inputSchema,
        renderAs,
        webhookUrl,
        enabled: true,
      });
    }
    summary.upserted.push(t.name);
    existingByName.delete(t.name);
  }

  // Anything left in `existingByName` was on the cloud but is no longer in
  // the remote registry — flag (don't delete; operator decides).
  summary.orphaned = [...existingByName.keys()];

  console.log(JSON.stringify({ ok: true, tenantId, ...summary }, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
