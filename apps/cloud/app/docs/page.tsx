import Link from 'next/link';

export const metadata = {
  title: 'Docs · aivoy',
  description: 'Quickstart and reference for the aivoy concierge.',
};

export default function DocsPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 240,
          borderRight: '1px solid var(--border)',
          padding: '24px 20px',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        <Link href="/" style={{ fontWeight: 700, fontSize: 18, color: 'inherit' }}>
          aivoy
        </Link>
        <nav style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <strong style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Get started
          </strong>
          <a href="#quickstart">Quickstart</a>
          <a href="#sign-up">1. Sign up</a>
          <a href="#provider">2. Add a provider</a>
          <a href="#tool">3. Register a tool</a>
          <a href="#token">4. Generate a token</a>
          <a href="#embed">5. Embed the widget</a>
          <strong
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginTop: 16,
            }}
          >
            Reference
          </strong>
          <a href="#tool-webhook">Tool webhook contract</a>
          <a href="#chat-api">Chat API</a>
          <a href="#config-api">Config API</a>
          <a href="#chunks">Stream chunks</a>
          <a href="#cards">Built-in card types</a>
        </nav>
      </aside>
      <main style={{ flex: 1, padding: '40px 56px', maxWidth: 880 }}>
        <h1 style={{ marginTop: 0 }}>Docs</h1>
        <p style={{ color: 'var(--muted)' }}>
          Drop a streaming AI concierge into any web app. Pick a model, paste your key,
          register a tool that hits your existing API, copy a token. Five minutes.
        </p>

        <Section id="quickstart">
          <H2>Quickstart</H2>
          <ol style={{ paddingLeft: 20, lineHeight: 1.9 }}>
            <li>
              <a href="/sign-up">Sign up</a> with email or your Google account.
            </li>
            <li>
              In <a href="/dashboard/providers">Providers</a>, paste your{' '}
              <strong>OpenAI / Anthropic / Gemini / Grok / Groq</strong> key. We seal it with
              AES-256-GCM and never re-display it.
            </li>
            <li>
              In <a href="/dashboard/tools">Tools</a>, register your data sources as webhooks.
              Each tool exposes a JSON Schema to the LLM and a URL we POST to.
            </li>
            <li>
              In <a href="/dashboard/tokens">Tokens</a>, generate a public token, set the
              allowed origins, and copy the embed snippet.
            </li>
            <li>Drop the snippet into your site. Done.</li>
          </ol>
        </Section>

        <Section id="sign-up">
          <H2>1. Sign up</H2>
          <p>
            Authentication is handled by Clerk. Each user gets a personal tenant on first
            visit; teams use Clerk organisations.
          </p>
        </Section>

        <Section id="provider">
          <H2>2. Add a provider</H2>
          <p>Open the dashboard → <a href="/dashboard/providers">Providers</a> → <em>Add provider</em>.</p>
          <p>
            We support the four major LLM APIs plus Groq (which is OpenAI-compatible — we
            route through the OpenAI adapter with the xAI base URL):
          </p>
          <ul>
            <li>
              <strong>OpenAI</strong> — <code>gpt-4o-mini</code>, <code>gpt-4o</code>, etc.
            </li>
            <li>
              <strong>Anthropic</strong> — <code>claude-sonnet-4-6</code>, etc.
            </li>
            <li>
              <strong>Gemini</strong> — <code>gemini-1.5-flash</code>, etc.
            </li>
            <li>
              <strong>Grok</strong> (xAI) — <code>grok-3-mini</code>, etc.
            </li>
            <li>
              <strong>Groq</strong> — fast inference for Llama, Mixtral, etc.
            </li>
          </ul>
          <Callout>
            Keys never leave aivoy's servers. They're decrypted only on the chat hot path,
            in memory, for one request.
          </Callout>
        </Section>

        <Section id="tool">
          <H2>3. Register a tool</H2>
          <p>
            Tools are how the assistant accesses your data. Open <a href="/dashboard/tools">Tools</a>
            → <em>Add tool</em>.
          </p>
          <p>Each tool has:</p>
          <ul>
            <li>
              <strong>Name</strong> — what the LLM calls it (e.g. <code>searchListings</code>).
            </li>
            <li>
              <strong>Description</strong> — shown to the LLM. Be specific about when to call it.
            </li>
            <li>
              <strong>Webhook URL</strong> — your endpoint. We POST when the LLM calls the tool.
            </li>
            <li>
              <strong>Input schema</strong> — JSON Schema. We pass this to the LLM so it knows
              what arguments to send.
            </li>
            <li>
              <strong>Render as</strong> (optional) — turn the result into a structured card
              (<code>listingCards</code>, <code>productCards</code>, <code>link</code>) instead
              of a plain text summary.
            </li>
          </ul>
          <p>
            On creation we also generate a webhook secret you'll use to verify our requests
            (see below).
          </p>
        </Section>

        <Section id="token">
          <H2>4. Generate a token</H2>
          <p>
            Open <a href="/dashboard/tokens">Tokens</a> → <em>Generate token</em>. Set the
            allowed origins (one per line) — browser requests with a different{' '}
            <code>Origin</code> header are rejected.
          </p>
          <p>Optional monthly cap returns 429 once exceeded.</p>
        </Section>

        <Section id="embed">
          <H2>5. Embed the widget</H2>
          <p>One script tag installs the floating concierge on any page:</p>
          <Code block>{`<script
  src="https://YOUR-AIVOY-HOST/embed/loader.js"
  data-token="pk_..."
  async
></script>`}</Code>
          <p style={{ marginTop: 16 }}>
            For React apps that already use the <code>aivoy</code> npm package, mount the{' '}
            <code>{'<Concierge>'}</code> component directly with the <code>proxyAdapter</code>:
          </p>
          <Code block>{`import { Concierge } from 'aivoy';
import { proxyAdapter } from 'aivoy/adapters';
import 'aivoy/styles.css';

<Concierge
  adapter={proxyAdapter({
    url: 'https://YOUR-AIVOY-HOST/embed/v1/chat',
    headers: { Authorization: 'Bearer pk_...' },
  })}
  assistant={{ name: 'Aivoy' }}
/>`}</Code>
        </Section>

        <Section id="tool-webhook">
          <H2>Tool webhook contract</H2>
          <p>
            When the LLM calls a tool, we POST to the webhook URL with this JSON body:
          </p>
          <Code block>{`{
  "tool": "searchListings",
  "args": { "city": "Paris", "guests": 1 },
  "tenantId": "612eaf6b-…",
  "tokenId": "653e841e-…"
}`}</Code>
          <p>
            Headers include <code>X-Aivoy-Signature: t=&#123;timestamp&#125;,v1=&#123;hex&#125;</code>{' '}
            where the signature is HMAC-SHA256 over <code>{'${timestamp}.${rawBody}'}</code>{' '}
            using the tool's webhook secret.
          </p>
          <p>Verify (Node.js):</p>
          <Code block>{`import { createHmac, timingSafeEqual } from 'node:crypto';

const sigHeader = req.headers['x-aivoy-signature'];
const m = /^t=(\\d+),v1=([0-9a-f]+)$/.exec(sigHeader);
if (!m) return res.status(401).end();
const [, ts, sig] = m;
const expected = createHmac('sha256', process.env.AIVOY_WEBHOOK_SECRET)
  .update(\`\${ts}.\${rawBody}\`).digest('hex');
if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
  return res.status(401).end();
}`}</Code>
          <p>
            Reply with whatever JSON you want — strings, objects, or (most usefully) the
            shape that matches your tool's <code>renderAs</code>. The LLM consumes it and
            decides what to say next.
          </p>
        </Section>

        <Section id="chat-api">
          <H2>Chat API</H2>
          <Code block>{`POST /embed/v1/chat
Authorization: Bearer pk_...
Origin: https://your-app.com
Content-Type: application/json

{ "messages": [{ "role": "user", "content": "..." }] }

→ application/x-ndjson
{"type":"text","delta":"Hello"}
{"type":"tool_status","id":"t_1","name":"searchListings","status":"done"}
{"type":"card","cardType":"listingCards","data":[…]}
{"type":"text","delta":" Here's what I found"}
{"type":"done"}`}</Code>
          <p>Response headers:</p>
          <ul>
            <li><code>X-RateLimit-Limit</code> · <code>X-RateLimit-Remaining</code> · <code>X-RateLimit-Reset</code></li>
            <li><code>Retry-After</code> on 429</li>
          </ul>
        </Section>

        <Section id="config-api">
          <H2>Config API</H2>
          <p>Used by the embed loader to populate the widget's name, greeting, and theme.</p>
          <Code block>{`GET /embed/v1/config
Authorization: Bearer pk_...
Origin: https://your-app.com

→ {
  "assistant": {
    "name": "Aivoy",
    "avatarUrl": null,
    "greeting": "Hi! How can I help?",
    "suggestedPrompts": ["Show me popular options"],
    "theme": { "accent": "#7c3aed" }
  }
}`}</Code>
        </Section>

        <Section id="chunks">
          <H2>Stream chunks</H2>
          <ul>
            <li><code>text</code> · token-by-token assistant reply</li>
            <li><code>tool_status</code> · tool was called (purely informational; widget renders a chip)</li>
            <li><code>card</code> · structured tool result, rendered via the widget's card renderer</li>
            <li><code>error</code> · provider or webhook error; widget surfaces inline</li>
            <li><code>done</code> · turn finished</li>
          </ul>
        </Section>

        <Section id="cards">
          <H2>Built-in card types</H2>
          <p>
            Set <code>renderAs</code> on a tool to render the result as a card. Built-in
            types validate against zod schemas:
          </p>
          <ul>
            <li>
              <code>listingCards</code> — array of <code>{`{ id, title, subtitle?, imageUrl?, price?, rating?, badges?, href? }`}</code>
            </li>
            <li>
              <code>productCards</code> — array of <code>{`{ id, title, imageUrl?, price?, href? }`}</code>
            </li>
            <li>
              <code>link</code> — single <code>{`{ title, description?, href, imageUrl? }`}</code>
            </li>
          </ul>
          <p>
            Custom card types: ship your own React component to your widget consumers via
            the <code>cards</code> prop on <code>{'<Concierge>'}</code>.
          </p>
        </Section>
      </main>
    </div>
  );
}

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      style={{
        marginTop: 40,
        scrollMarginTop: 24,
      }}
    >
      {children}
    </section>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 22, marginBottom: 12 }}>{children}</h2>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--accent-soft)',
        border: '1px solid var(--accent)',
        color: 'var(--accent)',
        padding: '10px 14px',
        borderRadius: 8,
        fontSize: 13,
        marginTop: 8,
      }}
    >
      {children}
    </div>
  );
}

function Code({ children, block }: { children: string; block?: boolean }) {
  return (
    <code
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: block ? 12 : 12,
        background: 'var(--accent-soft)',
        color: 'var(--accent)',
        padding: block ? 14 : '2px 6px',
        borderRadius: block ? 8 : 4,
        display: block ? 'block' : 'inline',
        whiteSpace: block ? 'pre' : 'nowrap',
        overflowX: block ? 'auto' : 'visible',
      }}
    >
      {children}
    </code>
  );
}
