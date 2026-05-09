<div align="center">

# aivoy

**An AI concierge you embed with one `<script>` tag.**

Bring your own LLM, register your data sources as webhooks, paste a token. Aivoy handles streaming, tool calls, multi-tenancy, rate limits, and rendering — without you owning a chat backend.

[Documentation](./apps/cloud/app/docs/page.tsx) · [Deploy](./DEPLOY.md)

</div>

---

## What it is

```html
<script
  src="https://your-aivoy-host/embed/loader.js"
  data-token="pk_..."
  async
></script>
```

That single tag installs a streaming chat widget anywhere — Webflow, Next.js, Shopify themes, plain HTML. Tools you registered in the dashboard become live actions the assistant can take against your existing API.

The whole stack is open and self-hostable: a multi-tenant Next.js cloud, a published npm widget, and a thin Cloudflare Worker proxy.

## What it isn't

- **Not another LLM provider.** Bring your own OpenAI / Anthropic / Gemini / Grok / Groq key. We never mark up usage.
- **Not a chat-history backend.** Threads live in the visitor's browser by default (`sessionStorage`). Plug in remote persistence per-tenant if you need it.
- **Not a no-code automation tool.** Tools are real code on your servers. We just call them.

## Quickstart

```bash
pnpm install
docker compose up -d                       # local Postgres
cp apps/cloud/.env.example apps/cloud/.env # add CLERK + AIVOY_MASTER_KEY
pnpm --filter @aivoy/cloud db:migrate
pnpm --filter aivoy build                  # builds the embed bundle
pnpm --filter @aivoy/cloud dev             # http://localhost:3030
```

Sign in → paste an LLM key → register a tool (start from a template) → generate a token → drop the snippet into any HTML file. End-to-end in five minutes.

## Architecture

```
                                   ┌─────────────────────────┐
                                   │  Customer's web app     │
                                   │  <script data-token=…>  │
                                   └──────────┬──────────────┘
                                              │  loader.js
                                              ▼
                          ┌─────────────────────────────────┐
                          │   aivoy.cloud (Next.js + Hono)  │
                          │   /embed/standalone.js          │  ← React+ReactDOM bundled
                          │   /embed/v1/config              │  ← per-tenant assistant config
                          │   /embed/v1/chat                │  ← NDJSON streaming
                          │   /dashboard                    │  ← Clerk-gated SaaS UI
                          └──────┬─────────────┬────────────┘
                                 │             │
                ┌────────────────┘             └────────────┐
                ▼                                           ▼
       ┌────────────────┐                       ┌──────────────────────┐
       │   LLM provider │                       │   Customer's API     │
       │  OpenAI / etc. │  ← BYO key            │  /aivoy/tools/:name  │  ← signed webhook
       └────────────────┘                       └──────────────────────┘
```

Per-request flow: visitor types → widget streams to `/embed/v1/chat` → aivoy decrypts the tenant's LLM credential, fetches tool definitions, opens an LLM stream → on tool calls aivoy POSTs an HMAC-signed payload to the customer's webhook → result is fed back to the LLM as a `tool` message → final text streams to the widget chunk-by-chunk.

## Highlights worth poking at

**Multi-LLM gateway behind one streaming interface.** Five providers (OpenAI, Anthropic, Gemini, Grok, Groq) implement a single `streamProvider()` contract returning `AsyncIterable<ProviderChunk>`. Tenants swap models without touching customer code; adding a sixth provider is ~80 lines.

**End-to-end credential isolation.** Provider keys are sealed with AES-256-GCM under a tenant-scoped envelope key on insert. They're decrypted only on the chat hot path, in memory, for the duration of one request. Never logged, never echoed by the API, never accessible to other tenants.

**Webhook tool router.** Turns the customer's existing REST API into LLM tools without them building anything new. Each call is HMAC-SHA256 signed (Stripe-style: `t={ts},v1={hex}`) with a 5-minute replay window and constant-time verification on the receiving side. The LLM's args are validated against the tool's JSON Schema before the webhook ever fires.

**Origin-pinned public tokens.** `pk_*` tokens are safe in browser source because every request validates the `Origin` header against a per-token allowlist. CORS, monthly message caps, and per-token usage accounting all hang off the same row.

**Card rendering in two flavors.**
- React consumers: `<Concierge cards={{ flightCard: ({ data }) => <FlightCard {...data} /> }} />`
- Vanilla sites: `window.aivoyCards = { flightCard: (data) => '<div>…</div>' }` set before the loader runs. The standalone bundle wraps each function as a React component via `useEffect` + ref, so non-React sites get full custom UI without adopting React.

**Tool-call de-duplication within a turn.** Some models re-emit the same `(name, args)` tool call across multiple LLM iterations even when the result is already in their context. The engine canonicalizes args via stable-stringify, caches the result for the turn, and short-circuits repeats — so the customer's webhook is never invoked twice for the same call.

**Multi-tenant from day one.** First-visit auto-creates a personal tenant keyed on `personal_<userId>`; Clerk organization IDs back team tenants. An atomic upsert handles the layout-and-page race on initial load. Every API call is scoped by tenant at the database boundary.

**Custom serverless entrypoint.** A purpose-built Vercel adapter ([`apps/cloud/src/vercel-entry.ts`](./apps/cloud/src/vercel-entry.ts)) materializes the request body up-front and hands Hono a clean Web Request. Predictable behavior across runtimes, identical input/output to the framework default.

**Edge delivery via Cloudflare.** A small Worker fronts the embed assets and API ([`apps/cloud/cloudflare-worker.js`](./apps/cloud/cloudflare-worker.js)) so customer browsers fetch from a global edge with low TTFB, while the origin terminates on Vercel.

**Mobile-first embed UI.** Drawer pattern with backdrop, body-scroll lock, ESC-to-close, link-tap auto-close. Same component reused across the dashboard and docs nav.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Cloud app | Next.js 15 + App Router + RSC | Server actions for dashboard mutations, server components for sidebar data, edge for `/embed/loader.js` |
| Auth + multi-tenancy | Clerk (orgs + personal) | Skip the auth side-quest; orgs map cleanly to tenants |
| Database | Postgres on Neon | Branchable for preview deploys, cheap idle |
| ORM | Drizzle | Fast, typed, migration history that's actually readable |
| API edge | Hono | Smaller than Express, better Web-Fetch ergonomics |
| LLM SDKs | OpenAI / Anthropic / Google / xAI native + Groq via OpenAI-compat | One streaming abstraction, native call shapes |
| Crypto | Node `webcrypto` AES-256-GCM | No deps, compliant primitive |
| Widget | React 18 + tsup IIFE bundle | One file, ~230 KB pre-gzip, ships React+ReactDOM with the widget so the host site doesn't need React |
| Embed delivery | Cloudflare Worker proxy → Vercel | Worker dodges `*.vercel.app` WAF; Vercel hosts the cloud |
| Forms | Server actions + zod | No client-state library; HTML semantics + progressive enhancement |
| Streaming | NDJSON over fetch | Plays well with Vercel functions, no SSE quirks, debuggable in DevTools |

## Repository

```
aiv/
├─ apps/
│  └─ cloud/                              Next.js 15 SaaS app
│     ├─ app/
│     │  ├─ embed/v1/{config,chat}/       public widget endpoints
│     │  ├─ (app)/dashboard/              Clerk-gated workspace
│     │  │  ├─ assistant/                 identity, theming, system prompt
│     │  │  ├─ providers/                 LLM credentials (sealed)
│     │  │  ├─ tools/                     webhook tool registry
│     │  │  ├─ tokens/                    public-key issuance
│     │  │  ├─ playground/                live chat against your config
│     │  │  └─ usage/                     per-token spend + caps
│     │  └─ docs/                         integration guide
│     ├─ lib/chat/                        provider streams, webhook signing, engine
│     ├─ db/                              Drizzle schema + migrations
│     └─ cloudflare-worker.js             reverse-proxy for *.vercel.app WAF dodge
├─ packages/
│  └─ aivoy/                              npm widget package
│     ├─ src/
│     │  ├─ standalone.tsx                IIFE bundle entry (window.Aivoy.mount)
│     │  ├─ ui/                           Concierge, MessageBubble, cards/
│     │  └─ adapters/                     proxy adapter for the chat endpoint
│     └─ tsup.config.ts
├─ docker-compose.yml                     local Postgres
└─ DEPLOY.md
```

## Local development

### Prereqs
- Node 20+, pnpm 9+
- Docker (or a Neon connection string)

### Setup
```bash
pnpm install
cp apps/cloud/.env.example apps/cloud/.env
# fill in CLERK_* keys (free dev instance at clerk.com)
# generate AIVOY_MASTER_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

docker compose up -d
pnpm --filter @aivoy/cloud db:migrate
pnpm --filter aivoy build         # builds the standalone bundle
pnpm --filter @aivoy/cloud dev    # → http://localhost:3030
```

### Working on the widget
```bash
pnpm --filter aivoy dev   # tsup watch — rebuilds on edit
# the cloud's /embed/standalone.js auto-updates from the rebuild
```

The widget's IIFE bundle ships its own React+ReactDOM, so changes there don't require restarting the cloud.

### Type checking
```bash
pnpm -r typecheck
```

## Deployment

Production runs on Vercel (cloud) + Cloudflare Workers (proxy) + Neon (Postgres) + Clerk (auth). Step-by-step in [DEPLOY.md](./DEPLOY.md).

The Vercel build runs both packages in order:
```jsonc
"vercel-build": "pnpm --filter aivoy build && next build"
```
…so the widget's standalone bundle is regenerated on every deploy and shipped from `/embed/standalone.js`.

## Roadmap

- [ ] End-user identity pass-through (signed user JWT to webhooks for tools that mutate user state)
- [ ] Tool result caching across turns (5-minute TTL keyed on stable args)
- [ ] Voice input via Whisper for the widget
- [ ] Anonymized eval harness (replay last 100 turns against a new model / system prompt before deploying)
- [ ] Chat handoff to human when the LLM signals low confidence

## License

MIT.
