# aivoy

Managed AI concierge for any web app. Pick a model, paste your key, copy a token. Tools are server-side webhooks so your data stays on your servers.

## Repo layout

This is a pnpm workspace.

```
.
├─ packages/
│  └─ aivoy/        ← npm package (the React widget)
├─ apps/
│  └─ cloud/        ← Next.js 15 SaaS app (dashboard + public API)
├─ docker-compose.yml
└─ pnpm-workspace.yaml
```

## Phase status

| # | Scope | Status |
|---|---|---|
| 1 | Foundation: monorepo, Next.js + Clerk + Drizzle + crypto | ✅ done |
| 2 | Public chat API: `/api/v1/chat` with provider routing + webhook tools + streaming | ⏳ next |
| 3 | Dashboard CRUD: providers, assistant, tools, tokens, playground | ⏳ |
| 4 | Embed loader: `<script src="cdn/loader.js">` install path | ⏳ |
| 5 | Polish: marketing landing, usage dashboard, rate limit UI, docs | ⏳ |

## Local dev

### Prereqs
- Node 20+, pnpm 9+
- Docker (for local Postgres) — or use a Neon connection string directly

### First-time setup

```bash
pnpm install
docker compose up -d                     # local Postgres on :5432
cp apps/cloud/.env.example apps/cloud/.env

# Generate the encryption master key (32 random bytes, base64):
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Paste the output into AIVOY_MASTER_KEY in apps/cloud/.env

# Create a Clerk app at https://dashboard.clerk.com and paste the keys.

pnpm db:generate     # generate migrations from schema
pnpm db:migrate      # apply them
```

### Run

```bash
pnpm dev:pkg        # watch-build the React widget
pnpm dev:cloud      # Next.js dashboard on http://localhost:3000
```

### Type-check everything

```bash
pnpm typecheck
```

## Security notes

- Tenant API keys (OpenAI/Anthropic/Gemini/Grok) are sealed at rest with libsodium secretbox using `AIVOY_MASTER_KEY`. Rotating that key requires re-encrypting every row in `provider_credentials`.
- Public `pk_*` tokens used by browser widgets are origin-checked against `integration_tokens.allowed_origins` on every request.
- Webhook tool calls are HMAC-signed with a per-tool `webhookSecret` so tenant servers can verify the call came from aivoy.

## Deploy (Vercel)

The cloud app deploys as-is to Vercel. Required env vars match `apps/cloud/.env.example`. Use Neon for the database — its connection string drops in unchanged.

## License

MIT (package). Cloud app source is in this repo for transparency; the deployed service runs at <TBD-domain>.
