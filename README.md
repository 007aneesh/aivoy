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

**`@hono/node-server/vercel` adapter bypass.** The official adapter hangs on POST bodies under certain Vercel runtimes (`Readable.toWeb(IncomingMessage)` never resolves). [`apps/cloud/src/vercel-entry.ts`](./apps/cloud/src/vercel-entry.ts) replaces it with a 50-line custom adapter that pre-reads the body to a Buffer and hands Hono a clean Web Request. Discovered via 30-second function timeouts; fixed by reading the IncomingMessage directly.

**Multi-LLM gateway with one streaming interface.** Five providers (OpenAI, Anthropic, Gemini, Grok, Groq) behind one `streamProvider()` returning `AsyncIterable<ProviderChunk>`. Adding a sixth is ~80 lines.

**Webhook tool router.** Turns the customer's existing REST API into LLM tools without them building anything new. HMAC-SHA256 signing (Stripe-style: `t={ts},v1={hex}`), 5-minute timestamp window, constant-time compare. JSON Schema validates the LLM's args before dispatch.

**AES-256-GCM credential sealing.** Provider keys are sealed with a tenant-scoped envelope key on insert, decrypted only on the chat hot path, in memory, for one request. Never logged, never returned by the API.

**Custom Vercel WAF dodge.** `*.vercel.app` system mitigations were 403'ing cross-site script loads from customer sites. A 30-line Cloudflare Worker proxy (free-tier `*.workers.dev` subdomain) sidesteps it for any tenant who hasn't paid for a custom domain. See [`apps/cloud/cloudflare-worker.js`](./apps/cloud/cloudflare-worker.js).

**Custom card rendering, two paths.**
- React npm consumers: `<Concierge cards={{ flightCard: ({ data }) => <FlightCard {...data} /> }}>`
- Vanilla script-tag consumers: `window.aivoyCards = { flightCard: (data) => '<div>…</div>' }` set before the loader runs. The standalone bundle wraps each function as a React component via `useEffect` + ref so non-React sites get full custom UI without learning React.

**Tool-call dedup across iterations.** Some models (Llama 3.3 on Groq especially) re-emit the same `(name, args)` tool call across multiple LLM iterations even though the result is in their context. Engine caches by stable-stringified args within a turn, short-circuits duplicates to the cached result, never hits the customer's webhook twice for the same call.

**Multi-tenant by org or solo.** First-visit auto-creates a personal tenant keyed on `personal_<userId>`; Clerk org IDs back team tenants. Atomic upsert handles the layout-and-page race on initial load.

**Mobile-responsive embed.** Drawer pattern with backdrop, body-scroll lock, ESC-to-close, link-tap auto-close. Same component reused in dashboard + docs nav.

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

## Trade-offs we picked

These are decisions, not regrets — engineers will recognize most of these.

- **No SSE.** NDJSON is simpler, framework-agnostic, debuggable. SSE's auto-reconnect would force per-event ID tracking we don't want.
- **No streaming SQL.** Tool results are bounded by design (cap to 6–12 items; LLMs choke on large payloads anyway). One round-trip per tool call.
- **No custom auth.** Clerk handles SSO, org switching, MFA. Saves weeks; locks in a vendor that's actually fine.
- **No queue for webhooks.** 15-second timeout, single-attempt. If your tool is slow, cache it on your side. Retries would mean idempotency keys for destructive tools — added scope.
- **No per-message cost UI in v1.** Usage is summed daily by token; per-message cost waits until provider pricing APIs stabilise.

## Roadmap

- [ ] End-user identity pass-through (signed user JWT to webhooks for tools that mutate user state)
- [ ] Tool result caching across turns (5-minute TTL keyed on stable args)
- [ ] Voice input via Whisper for the widget
- [ ] Anonymized eval harness (replay last 100 turns against a new model / system prompt before deploying)
- [ ] Chat handoff to human when the LLM signals low confidence

## License

MIT.
