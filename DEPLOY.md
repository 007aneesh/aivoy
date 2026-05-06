# Deploying aivoy

A self-hosted production deploy of the aivoy SaaS to Vercel + Neon + Clerk.

## TL;DR

```bash
# 1. Database
DATABASE_URL='postgres://...neon...' pnpm --filter @aivoy/cloud exec tsx db/migrate.ts

# 2. Master encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 3. Vercel project: import repo, root dir = apps/cloud, paste env vars below.

# 4. git push
```

Vercel will run `pnpm vercel-build` which builds the npm package's standalone
bundle, copies it into `apps/cloud/public/embed/standalone.js`, then runs
`next build`.

## Required env vars

| Name | Where to get it |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API keys |
| `CLERK_SECRET_KEY` | Clerk dashboard → API keys |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/dashboard` |
| `DATABASE_URL` | Neon → pooled connection string |
| `AIVOY_MASTER_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.example` |

## Migrations on a new database

`db:migrate` is a one-shot runner. Run it locally pointing at the production
DATABASE_URL the first time and any time `db/migrations/` gains a new file.

```bash
DATABASE_URL='postgres://...' pnpm --filter @aivoy/cloud db:migrate
```

A future improvement is to wire this into Vercel as a Build hook or as part
of `vercel-build`. Today we keep it manual to avoid migrating from inside
serverless functions.

## Master-key rotation

If `AIVOY_MASTER_KEY` ever leaks: generate a new one, then re-encrypt every
row in `provider_credentials`:

```ts
// pseudo-code: keep BOTH old and new master keys live during rollout.
for (const row of provider_credentials) {
  const plaintext = openSecretWith(OLD_KEY, row.encrypted_key);
  row.encrypted_key = sealSecretWith(NEW_KEY, plaintext);
}
```

Then rotate the env var to the new key and remove the old one. Tenants
shouldn't notice.

## Custom domain

Vercel → Project → Domains → add your domain, follow the DNS instructions.
Then update `NEXT_PUBLIC_APP_URL` and redeploy.

## Smoke test after deploy

```bash
curl https://YOUR-HOST/api/health
curl -I https://YOUR-HOST/embed/loader.js
curl -I https://YOUR-HOST/embed/standalone.js
```

All three should return 200.

## Cost ceiling

- Vercel: streaming chats are long-lived function invocations; Hobby's 100s
  function-execution budget is too small for production. Use Pro ($20/mo).
- Neon: free tier (0.5 GB) is fine until usage_events grows past ~5M rows.
  Add a periodic prune of events > 90 days old, or upgrade.
- Clerk: free up to 10k MAU.

## Publishing the npm package

Independent of the cloud deploy. Whenever the widget API changes:

```bash
cd packages/aivoy
pnpm version patch       # or minor / major
pnpm build
npm publish --access public
```
