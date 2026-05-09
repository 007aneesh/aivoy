import Link from 'next/link';
import { MobileShellNav } from '@/components/MobileShellNav';

export const metadata = {
  title: 'Docs · aivoy',
  description: 'Integrate the aivoy AI concierge in any web app — quickstart and reference.',
};

export default function DocsPage() {
  const sidebar = <DocsSidebarContent />;
  return (
    <div className="docs-shell">
      <MobileShellNav brandLabel="aivoy docs">{sidebar}</MobileShellNav>
      <aside className="docs-sidebar desktop-only">{sidebar}</aside>

      <main className="docs-main">
        <div className="docs-content">
          <span className="pill pill-accent" style={{ marginBottom: 16 }}>Documentation</span>
          <h1 style={{ marginBottom: 12 }}>Integrate aivoy in 5 minutes</h1>
          <p style={{ fontSize: 16, color: 'var(--fg-soft)', maxWidth: 640 }}>
            A drop-in AI concierge for any web app. Pick an LLM, register your data sources as
            webhooks, paste a token. The widget streams answers, calls your tools, and renders rich
            cards — without you owning a chat backend.
          </p>

          <Section id="what-is-aivoy">
            <H2>What is aivoy?</H2>
            <p>aivoy is three things stitched together:</p>
            <ul>
              <li>
                A <b>floating chat widget</b> you embed with one <code className="code">&lt;script&gt;</code> tag.
                Streams responses, renders cards, persists per-tab.
              </li>
              <li>
                A <b>multi-LLM gateway</b>. Bring your own OpenAI / Anthropic / Gemini / Grok / Groq
                key — switch providers without touching a single line of customer code.
              </li>
              <li>
                A <b>tool router</b>. Register a webhook URL + JSON schema; we sign every call,
                validate args, and pipe the result back to the LLM.
              </li>
            </ul>
            <Callout variant="info">
              You never run a chat server. Your existing API stays where it is — aivoy just calls
              into it as the LLM needs.
            </Callout>
          </Section>

          <Section id="quickstart">
            <H2>5-minute quickstart</H2>
            <ol>
              <li>
                <Link href="/sign-up">Create an account</Link>. Each user gets a tenant.
              </li>
              <li>
                <Link href="/dashboard/providers">Providers</Link> → paste an LLM API key. Sealed
                with AES-256-GCM, never re-displayed.
              </li>
              <li>
                <Link href="/dashboard/assistant">Assistant</Link> → name, greeting, system prompt,
                suggested prompts.
              </li>
              <li>
                <Link href="/dashboard/tools">Tools</Link> → optional. Add a webhook URL + input
                schema for each data source you want the LLM to call.
              </li>
              <li>
                <Link href="/dashboard/tokens">Tokens</Link> → generate a public token, list your
                site origins, copy the snippet below.
              </li>
              <li>Paste the snippet into your site. Done.</li>
            </ol>
          </Section>

          <Section id="install">
            <H2>Install the widget</H2>
            <p>Drop this into your site's <code className="code">&lt;head&gt;</code> or before the closing <code className="code">&lt;/body&gt;</code>:</p>
            <CodeBlock>{`<script
  src="https://YOUR-AIVOY-HOST/embed/loader.js"
  data-token="pk_..."
  async
></script>`}</CodeBlock>
            <p>That's it. A floating launcher appears in the bottom-right; clicking it opens the chat.</p>

            <H3>Optional attributes</H3>
            <Table
              columns={['Attribute', 'Description']}
              rows={[
                [<code key="t" className="code">data-token</code>, <>Required. Your <code className="code">pk_…</code> token from the dashboard.</>],
                [<code key="h" className="code">data-host</code>, <>Override the API host (e.g. when proxying through your own domain — see <a href="#proxy">Reverse-proxy</a>).</>],
                [<code key="g" className="code">data-target</code>, <>CSS selector. Mounts the widget inside this element instead of as a floating launcher.</>],
              ]}
            />
          </Section>

          <Section id="integrations">
            <H2>Framework recipes</H2>

            <H3>Vanilla HTML / any framework</H3>
            <p>The script tag above works in any HTML page — Webflow, Framer, WordPress, Shopify themes, plain HTML.</p>

            <H3>Next.js (App Router)</H3>
            <CodeBlock>{`// app/layout.tsx
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <Script
          src={\`\${process.env.NEXT_PUBLIC_AIVOY_HOST}/embed/loader.js\`}
          data-token={process.env.NEXT_PUBLIC_AIVOY_TOKEN}
          data-host={process.env.NEXT_PUBLIC_AIVOY_HOST}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}`}</CodeBlock>

            <H3>React app (npm package)</H3>
            <p>If you'd rather embed the widget as a React component (no external script), install the package:</p>
            <CodeBlock>{`npm install aivoy`}</CodeBlock>
            <CodeBlock>{`import { Concierge } from 'aivoy';
import { proxyAdapter } from 'aivoy/adapters';
import 'aivoy/styles.css';

export function ChatWidget({ token, host }: { token: string; host: string }) {
  return (
    <Concierge
      adapter={proxyAdapter({
        url: \`\${host}/embed/v1/chat\`,
        headers: () => ({ Authorization: \`Bearer \${token}\` }),
      })}
      assistant={{ name: 'Concierge' }}
      persistence={{ strategy: 'session', key: \`aivoy:\${token.slice(0, 12)}\` }}
    />
  );
}`}</CodeBlock>
            <p className="muted text-sm">Use the npm package when you want full control over mounting, custom card components, or a non-floating layout.</p>
          </Section>

          <Section id="assistant">
            <H2>Assistant</H2>
            <p>Configure the persona in <Link href="/dashboard/assistant">dashboard → Assistant</Link>:</p>
            <ul>
              <li><b>Name</b> — header text and accessible label.</li>
              <li><b>Avatar URL</b> — optional 1× image, square-cropped.</li>
              <li><b>Greeting</b> — first message shown when the chat opens.</li>
              <li><b>Suggested prompts</b> — chips below the greeting (3–6 work best).</li>
              <li><b>System prompt</b> — appended to aivoy's base prompt. Use it to define tone, scope, and refusal behaviour.</li>
              <li><b>Theme</b> — accent colour and light/dark mode override.</li>
            </ul>
          </Section>

          <Section id="providers">
            <H2>LLM providers</H2>
            <p>Bring your own key — aivoy never marks up usage.</p>
            <Table
              columns={['Provider', 'Notes']}
              rows={[
                ['OpenAI', <>e.g. <code className="code">gpt-4o-mini</code>, <code className="code">gpt-4o</code></>],
                ['Anthropic', <>e.g. <code className="code">claude-sonnet-4-6</code></>],
                ['Gemini', <>e.g. <code className="code">gemini-1.5-flash</code></>],
                ['Grok (xAI)', <>e.g. <code className="code">grok-3-mini</code></>],
                ['Groq', <>Fast inference for Llama / Mixtral. OpenAI-compatible.</>],
              ]}
            />
            <Callout variant="info">
              Keys are decrypted only on the chat hot path, in memory, for one request. They're
              never logged or returned by the API.
            </Callout>
          </Section>

          <Section id="tools">
            <H2>Tools</H2>
            <p>
              Tools are how the assistant reads (and writes to) your data. The LLM reads the
              user's message, picks a tool from the ones you've registered, fills in the args
              against your JSON Schema, and aivoy POSTs to your webhook with a signed payload.
              Your response goes back into the LLM's context for the next turn.
            </p>

            <H3>Anatomy of a tool</H3>
            <Table
              columns={['Field', 'Purpose', 'Tips']}
              rows={[
                [<code key="n" className="code">name</code>, 'The function name the LLM calls.', 'camelCase, ≤ 48 chars. Match the verb the user might use ("search", "get", "create").'],
                [<code key="d" className="code">description</code>, 'How the LLM decides whether to call this tool vs another.', 'This is the most important field. State both what it does AND when to use it. The LLM picks tools on description alone.'],
                [<code key="i" className="code">inputSchema</code>, 'JSON Schema validating the args the LLM sends.', 'Use clear property descriptions, set sensible defaults, prefer enums over free-text where you can.'],
                [<code key="w" className="code">webhookUrl</code>, 'The endpoint aivoy POSTs to.', 'Must be reachable from the public internet (your existing API works fine).'],
                [<code key="r" className="code">renderAs</code>, 'Tells the widget to render the response as a card instead of letting the LLM summarize.', 'Use a built-in (listingCards, productCards, link) or your own custom key. Optional.'],
                [<code key="e" className="code">enabled</code>, 'Whether this tool is exposed to the LLM right now.', 'Disable to A/B test descriptions or take a tool down without deleting.'],
              ]}
            />

            <H3>Naming the tool</H3>
            <p>
              The tool's <code className="code">name</code> matters less than its description, but a
              good name still helps. Three rules:
            </p>
            <ul>
              <li>Use a verb-first camelCase identifier. <code className="code">searchProducts</code>, <code className="code">getOrderStatus</code>, <code className="code">cancelBooking</code> — not <code className="code">products</code> or <code className="code">my_search_endpoint</code>.</li>
              <li>Pair the verb with the noun. <code className="code">searchProducts</code> is better than <code className="code">find</code>; <code className="code">cancelBooking</code> is clearer than <code className="code">cancel</code>.</li>
              <li>One verb per tool. If you find yourself writing <code className="code">searchOrCreate</code>, that's two tools.</li>
            </ul>

            <H3>Writing a good description</H3>
            <p>
              The LLM sees the description verbatim. It uses it to decide:{' '}
              <em>do I call this tool, and if so, with what args?</em> Treat it like a
              one-paragraph spec.
            </p>
            <p>A description does three jobs:</p>
            <ol>
              <li><b>Describe what it returns</b>, in plain English. ("Returns up to 12 product cards matching the query.")</li>
              <li><b>Spell out when to use it</b>, especially vs other tools. ("Use whenever the user asks to find or compare products. For details on a specific product, use <code className="code">getProduct</code> instead.")</li>
              <li><b>Mention required-but-non-obvious args</b>. ("Call with <code className="code">tenantId</code> from the chat context — never trust args.tenantId from the user.")</li>
            </ol>
            <Callout variant="info">
              If the LLM picks a tool when it shouldn't, or skips it when it should, the fix is
              almost always to tighten the description — not the schema or the prompt.
            </Callout>

            <H4>Examples</H4>
            <CodeBlock>{`// ❌ Vague — the LLM has to guess
"Searches stuff"

// ❌ Restates the name
"Search products"

// ✅ Specific about both behavior and applicability
"Search the product catalogue by free-text query, category, or
price range. Returns up to 12 product cards. Use whenever the user
asks to discover, compare, or filter products. Don't use for
single-product details — use \`getProduct\` for that."`}</CodeBlock>

            <H3>Designing the input schema</H3>
            <p>
              The schema is JSON Schema. aivoy validates the LLM's args against it before calling
              your webhook, so a malformed call returns 400 server-side and the LLM tries again.
            </p>

            <H4>Skeleton</H4>
            <CodeBlock>{`{
  "type": "object",
  "properties": {
    "query":    { "type": "string",  "description": "Free-text search term" },
    "category": { "type": "string",  "enum": ["clothing", "electronics", "home"] },
    "maxPrice": { "type": "number",  "minimum": 0 },
    "limit":    { "type": "integer", "minimum": 1, "maximum": 12, "default": 6 }
  },
  "required": ["query"]
}`}</CodeBlock>

            <H4>Schema-design rules</H4>
            <ul>
              <li>
                <b>Add a <code className="code">description</code> on every property.</b> The LLM
                reads them when filling args. Without descriptions, you'll get garbage values for
                free-text fields.
              </li>
              <li>
                <b>Prefer <code className="code">enum</code> for fixed sets.</b> If
                <code className="code">category</code> only has 3 valid values, list them. The LLM
                is far more reliable picking from an enum than fabricating one.
              </li>
              <li>
                <b>Set <code className="code">minimum</code> / <code className="code">maximum</code> on numerics.</b>{' '}
                LLMs sometimes pass 100 when you expect 1–10. Constrain it.
              </li>
              <li>
                <b>Use <code className="code">default</code> for sensible fallbacks.</b> The widget
                doesn't enforce defaults itself; <em>you</em> apply them in your handler. But the
                schema's <code className="code">default</code> is also passed to the LLM as a hint.
              </li>
              <li>
                <b>Mark only <em>truly</em> required args as <code className="code">required</code>.</b> Over-requiring
                makes the LLM ask the user for fields you could safely default.
              </li>
              <li>
                <b>Don't accept tenant / user IDs from the LLM.</b> The webhook payload already
                has <code className="code">tenantId</code> and <code className="code">tokenId</code>. Look up the user
                server-side from <code className="code">tokenId</code>.
              </li>
            </ul>

            <H4>Date / time fields</H4>
            <p>
              For dates, ask for ISO format and document it in the description. LLMs reliably
              produce correct ISO strings:
            </p>
            <CodeBlock>{`"checkIn":  { "type": "string", "description": "Check-in date, ISO 8601 (YYYY-MM-DD)" },
"checkOut": { "type": "string", "description": "Check-out date, ISO 8601 (YYYY-MM-DD)" }`}</CodeBlock>

            <H3>Choosing how the result renders</H3>
            <p>
              When you create a tool in the dashboard, the <b>Render as</b> field is a dropdown,
              not a free-text input — you don't have to remember any magic strings. It tells the
              widget how to display the tool's response. The LLM sees the raw JSON either way; the
              choice only affects what the user sees.
            </p>
            <Table
              columns={['Pick this', 'When', 'Example use case']}
              rows={[
                ['Plain text (no card)', 'You want the LLM to read your data and write a sentence.', '"Your order shipped Tuesday, expected Friday."'],
                ['Listing cards', 'You return a list of stays / properties / similar items.', 'Travel stays, real estate listings'],
                ['Product cards', 'You return a list of items in a storefront.', 'E-commerce search results'],
                ['Link card', 'You return a single URL the user should open.', '"Track shipment", "Open dashboard"'],
                ['Custom — register on the embed', 'None of the built-ins fit.', 'Flight cards, weather, reservation timeline'],
              ]}
            />
            <p className="muted text-sm">
              Internally each dashboard option saves a short identifier (<code className="code">listingCards</code>,{' '}
              <code className="code">productCards</code>, <code className="code">link</code>) that becomes the{' '}
              <code className="code">cardType</code> on the streaming{' '}
              <a href="#chunks"><code className="code">card</code></a> chunk. You only need to know the
              identifier when shipping a <a href="#cards">custom card</a> — the key in your renderer
              map must match.
            </p>

            <Callout variant="warning">
              When you pick a built-in, the widget validates your webhook's response against that
              card's schema. A shape mismatch falls back to a JSON dump and the LLM tends to retry
              the call thinking it failed. Match the shape under{' '}
              <a href="#cards">Built-in cards</a> exactly, or use a custom card.
            </Callout>

            <H3>Custom card — when none of the built-ins fit</H3>
            <p>
              In the dashboard, pick <b>"Custom — register on the embed"</b> in the Render-as
              dropdown. A second field appears for the identifier (e.g.{' '}
              <code className="code">flightCard</code>) — that's the key your renderer will be keyed
              under at embed time:
            </p>
            <CodeBlock>{`<script>
  window.aivoyCards = {
    flightCard: (data) => \`
      <div class="my-flight">
        <strong>\${data.airline} \${data.flightNumber}</strong>
        <span>\${data.from} → \${data.to}</span>
        <span>\${data.departLabel}</span>
      </div>
    \`,
  };
</script>
<script src="https://YOUR-AIVOY-HOST/embed/loader.js" data-token="pk_..." async></script>`}</CodeBlock>
            <p>
              Your tool's webhook returns whatever shape your renderer expects — aivoy passes
              <code className="code">data</code> through unchanged. See{' '}
              <a href="#cards">Custom cards</a> for the React-component path used by npm-package
              consumers.
            </p>

            <H3>Tool patterns</H3>

            <H4>Search → detail</H4>
            <p>
              Two-tool flow: a broad <code className="code">searchX</code> with a card{' '}
              <code className="code">renderAs</code>, plus a focused{' '}
              <code className="code">getX</code> for follow-ups. The user asks "show me jackets",
              gets cards. They click one and ask "is this in stock in M?" — the LLM calls{' '}
              <code className="code">getX</code> with the id from the previous card.
            </p>

            <H4>Status / lookup</H4>
            <p>
              Read-only check (<code className="code">getOrderStatus</code>,{' '}
              <code className="code">getBookingDetails</code>). Usually no{' '}
              <code className="code">renderAs</code> — let the LLM summarize ("Your order shipped
              Tuesday, expected delivery Friday"). Faster than a full card, more conversational.
            </p>

            <H4>Action with confirmation</H4>
            <p>
              Destructive operations (<code className="code">cancelBooking</code>,{' '}
              <code className="code">refundOrder</code>): describe the consequence in the tool's
              description and require explicit IDs in the args. Your webhook should still confirm
              ownership before doing the work — never trust the LLM to send the right{' '}
              <code className="code">orderId</code> for the right user.
            </p>
            <CodeBlock>{`{
  "name": "cancelBooking",
  "description":
    "Cancel a confirmed booking by id. Cancellation fees may apply per the listing's policy. Confirm with the user before calling — this is destructive.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "bookingId": { "type": "string", "description": "Booking id from a prior search or status check" },
      "reason":    { "type": "string", "description": "Optional reason the user gave" }
    },
    "required": ["bookingId"]
  }
}`}</CodeBlock>

            <H4>Personalised picks</H4>
            <p>
              Recommendation tool that uses <code className="code">tokenId</code> server-side to
              pull user preferences. The LLM doesn't need to know the user's identity — your
              webhook resolves it from the token. Returns{' '}
              <code className="code">productCards</code> or <code className="code">listingCards</code>.
            </p>

            <H3>How many tools should I register?</H3>
            <p>
              Three to seven is the sweet spot. Fewer than three, the assistant feels limited.
              More than seven, the LLM struggles to pick the right one and you spend prompt budget
              on every turn. If you have many tools, group similar ones (e.g. a single{' '}
              <code className="code">search</code> with an <code className="code">entity</code>{' '}
              enum, instead of <code className="code">searchProducts</code>,{' '}
              <code className="code">searchPosts</code>, <code className="code">searchUsers</code>).
            </p>

            <H3>Common pitfalls</H3>
            <ul>
              <li><b>Description too short.</b> "Searches" → the LLM calls it for everything.</li>
              <li><b>Description too long.</b> 200+ words → the LLM ignores half of it. 2–4 sentences max.</li>
              <li><b>No <code className="code">enum</code> on a categorical field.</b> The LLM invents categories.</li>
              <li><b>Returning a card shape that doesn't validate.</b> Falls back to a JSON dump in the chat (see <a href="#cards">Built-in cards</a>).</li>
              <li><b>Returning huge JSON.</b> The LLM has to fit it in its context. Cap to 6–12 items, drop fields the LLM doesn't need.</li>
              <li><b>Webhook latency.</b> 15-second timeout. If your search is slow, cache or pre-compute.</li>
              <li><b>Ambiguous between two tools.</b> Either tighten descriptions, or merge them with an enum arg.</li>
            </ul>

            <H3>Iterating on tools</H3>
            <p>
              Tool design is iterative. Workflow:
            </p>
            <ol>
              <li>Add the tool, set <code className="code">enabled</code> on.</li>
              <li>Try a few real prompts in the <Link href="/dashboard/playground">playground</Link>.</li>
              <li>Watch which prompts trigger the tool (or skip it when they shouldn't).</li>
              <li>Tighten the description; adjust the schema (more enums, better property descriptions).</li>
              <li>Repeat. Most tools take 3–5 iterations to feel right.</li>
            </ol>
          </Section>

          <Section id="tokens">
            <H2>Tokens</H2>
            <p>Public tokens (<code className="code">pk_…</code>) authenticate the widget. They're safe to ship in client-side code.</p>
            <ul>
              <li><b>Allowed origins</b> — exact <code className="code">https://yoursite.com</code> values, one per line. Required.</li>
              <li><b>Monthly message cap</b> — optional. Returns 429 once exceeded.</li>
              <li><b>Revoke</b> at any time from the dashboard.</li>
            </ul>
            <p>Generate one token per environment — separate dev, staging, and production allowlists.</p>
          </Section>

          <Section id="theming">
            <H2>Theming</H2>
            <p>
              Match the widget to your brand. All theming lives in the dashboard at{' '}
              <Link href="/dashboard/assistant">Assistant → Theme</Link> — there's no JSON to write.
            </p>

            <Table
              columns={['Control', 'What it does', 'Where it shows']}
              rows={[
                ['Accent colour', 'Primary brand colour. Pick from a 6-swatch palette, the OS colour picker, or paste a hex.', 'Send button, suggested-prompt chips, the floating launcher, link colours inside the panel.'],
                ['Color mode', '"Auto" follows the visitor\'s OS. "Light" / "Dark" force one regardless.', 'Background and text contrast in the chat panel.'],
                ['Launcher position', 'Bottom-right or bottom-left.', 'Where the floating chat button sits on the host page.'],
                ['Avatar URL', 'Optional square image (PNG/JPG/SVG, served over HTTPS).', 'Chat header next to the assistant name.'],
              ]}
            />

            <p>
              The widget fetches your saved theme from <a href="#config-api"><code className="code">/embed/v1/config</code></a>{' '}
              when it boots and applies it before the first paint, so visitors don't see a flash of
              the unstyled default.
            </p>

            <H3>Going further with React</H3>
            <p>
              The dashboard covers 95% of cases. If you need full control — custom fonts, bespoke
              CSS, your own launcher, custom cards — embed via the npm package instead and pass{' '}
              <code className="code">theme</code> and <code className="code">cards</code> directly to{' '}
              <code className="code">&lt;Concierge&gt;</code>. See <a href="#integrations">Framework recipes</a>.
            </p>
          </Section>

          <Section id="tool-webhook">
            <H2>Tool webhook contract</H2>
            <p>When the LLM calls a tool, aivoy POSTs to the configured URL:</p>
            <CodeBlock>{`POST <your webhook URL>
Content-Type: application/json
X-Aivoy-Signature: t=<unix-seconds>,v1=<hex-hmac-sha256>
User-Agent: aivoy-webhook/1.0

{
  "tool": "searchListings",
  "args": { "city": "Paris", "guests": 1 },
  "tenantId": "612eaf6b-…",
  "tokenId":  "653e841e-…"
}`}</CodeBlock>

            <H3>Verifying the signature</H3>
            <p>Recompute HMAC-SHA256 over <code className="code">{'`${timestamp}.${rawBody}`'}</code> with your tenant signing secret. Reject when:</p>
            <ul>
              <li>The header is missing or malformed.</li>
              <li>The timestamp is more than 5 minutes off (replay protection).</li>
              <li>The HMAC doesn't match (constant-time compare).</li>
            </ul>
            <CodeBlock>{`// Node.js
import { createHmac, timingSafeEqual } from 'node:crypto';

const sigHeader = req.headers['x-aivoy-signature'];
const m = /^t=(\\d+),v1=([0-9a-f]+)$/.exec(sigHeader ?? '');
if (!m) return res.status(401).end();

const [, ts, sig] = m;
if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return res.status(401).end();

const expected = createHmac('sha256', process.env.AIVOY_WEBHOOK_SECRET)
  .update(\`\${ts}.\${rawBody}\`)
  .digest('hex');
if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
  return res.status(401).end();
}`}</CodeBlock>
            <Callout variant="warning">
              Read the <em>raw</em> request body for the HMAC. Frameworks that re-serialize the body
              (Express's default json parser, NestJS interceptors) will produce a different byte
              string and your signature check will fail.
            </Callout>

            <H3>Response</H3>
            <p>Return any JSON. The LLM consumes it and continues the turn. If your tool has a <code className="code">renderAs</code>, the response shape must match the card schema (see <a href="#cards">Built-in cards</a>).</p>
          </Section>

          <Section id="build-webhook">
            <H2>Build a tool webhook</H2>
            <p>
              Walk-through: a <code className="code">searchProducts</code> tool returns matching products from
              your database, rendered as <code className="code">productCards</code> in the widget. Same shape works
              for any tool — swap the DB query and the response shape.
            </p>

            <H3>What you're building</H3>
            <ol>
              <li>An HTTP endpoint that accepts <code className="code">POST</code> JSON.</li>
              <li>Verifies the <code className="code">X-Aivoy-Signature</code> header against your tenant secret.</li>
              <li>Validates <code className="code">args</code> matches the tool's input schema.</li>
              <li>Queries your data source.</li>
              <li>Returns JSON in the shape your <code className="code">renderAs</code> expects (or any JSON if no <code className="code">renderAs</code>).</li>
            </ol>

            <H3>Tool config in aivoy</H3>
            <p>In <Link href="/dashboard/tools">Tools</Link> → Add tool, register:</p>
            <Table
              columns={['Field', 'Value']}
              rows={[
                ['Name', <code key="n" className="code">searchProducts</code>],
                ['Description', '"Search the catalogue by keyword, category, or price range. Use whenever the user asks to find products."'],
                ['Webhook URL', <code key="u" className="code">https://api.yourbrand.com/aivoy/tools/searchProducts</code>],
                ['Input schema', <code key="s" className="code">{`{ query?: string, category?: string, maxPrice?: number, limit?: number }`}</code>],
                ['Render as', <code key="r" className="code">productCards</code>],
              ]}
            />
            <p>aivoy generates a <b>webhook signing secret</b> when you save — copy it into your backend's env as <code className="code">AIVOY_WEBHOOK_SECRET</code>. It's shown once.</p>

            <H3>Express (Node.js)</H3>
            <CodeBlock>{`import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const app = express();

// CRITICAL: capture raw body BEFORE express.json() consumes it.
app.use('/aivoy/tools', express.json({
  verify: (req: any, _res, buf) => { req.rawBody = buf.toString('utf8'); },
}));

const Args = z.object({
  query:    z.string().optional(),
  category: z.string().optional(),
  maxPrice: z.number().positive().optional(),
  limit:    z.number().int().min(1).max(20).default(8),
});

app.post('/aivoy/tools/searchProducts', async (req: any, res) => {
  // 1. Verify signature
  const sigHeader = req.header('x-aivoy-signature') ?? '';
  const m = /^t=(\\d+),v1=([0-9a-f]+)$/.exec(sigHeader);
  if (!m) return res.status(401).json({ error: 'missing signature' });

  const [, ts, sig] = m;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) {
    return res.status(401).json({ error: 'stale signature' });
  }
  const expected = createHmac('sha256', process.env.AIVOY_WEBHOOK_SECRET!)
    .update(\`\${ts}.\${req.rawBody}\`)
    .digest('hex');
  if (sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return res.status(401).json({ error: 'bad signature' });
  }

  // 2. Validate the tool name + args
  const { tool, args } = req.body;
  if (tool !== 'searchProducts') return res.status(400).json({ error: 'wrong tool' });

  const parsed = Args.safeParse(args);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid args', issues: parsed.error.issues });
  }

  // 3. Query your data
  const products = await db.products.findMany({
    where: {
      AND: [
        parsed.data.query    ? { name: { contains: parsed.data.query, mode: 'insensitive' } } : {},
        parsed.data.category ? { category: parsed.data.category } : {},
        parsed.data.maxPrice ? { priceCents: { lte: parsed.data.maxPrice * 100 } } : {},
      ],
    },
    take: parsed.data.limit,
  });

  // 4. Return shape that matches \`productCards\`
  return res.json(
    products.map((p) => ({
      id:       p.id,
      title:    p.name,
      imageUrl: p.coverImageUrl,
      price:    { amount: p.priceCents / 100, currency: p.currency },
      href:     \`https://yourbrand.com/products/\${p.slug}\`,
    })),
  );
});

app.listen(3000);`}</CodeBlock>

            <H3>Next.js Route Handler (App Router)</H3>
            <CodeBlock>{`// app/aivoy/tools/searchProducts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const Args = z.object({
  query:    z.string().optional(),
  category: z.string().optional(),
  maxPrice: z.number().positive().optional(),
  limit:    z.number().int().min(1).max(20).default(8),
});

export async function POST(req: NextRequest) {
  // Read raw body via the underlying Web Request — Next's c.req.text()
  // can hang on Vercel. See aivoy docs → Reverse-proxy guide.
  const rawBody = await req.text();

  const sigHeader = req.headers.get('x-aivoy-signature') ?? '';
  const m = /^t=(\\d+),v1=([0-9a-f]+)$/.exec(sigHeader);
  if (!m) return NextResponse.json({ error: 'missing signature' }, { status: 401 });

  const [, ts, sig] = m;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) {
    return NextResponse.json({ error: 'stale signature' }, { status: 401 });
  }
  const expected = createHmac('sha256', process.env.AIVOY_WEBHOOK_SECRET!)
    .update(\`\${ts}.\${rawBody}\`)
    .digest('hex');
  if (sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  const { tool, args } = JSON.parse(rawBody);
  if (tool !== 'searchProducts') {
    return NextResponse.json({ error: 'wrong tool' }, { status: 400 });
  }

  const parsed = Args.safeParse(args);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid args' }, { status: 400 });
  }

  const products = await db.products.findMany({ /* … */ take: parsed.data.limit });

  return NextResponse.json(
    products.map((p) => ({
      id:       p.id,
      title:    p.name,
      imageUrl: p.coverImageUrl,
      price:    { amount: p.priceCents / 100, currency: p.currency },
      href:     \`https://yourbrand.com/products/\${p.slug}\`,
    })),
  );
}`}</CodeBlock>

            <H3>Python (FastAPI)</H3>
            <CodeBlock>{`# main.py
import hmac, hashlib, time, os
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from typing import Optional

app = FastAPI()
SECRET = os.environ['AIVOY_WEBHOOK_SECRET'].encode()

class Args(BaseModel):
    query:    Optional[str] = None
    category: Optional[str] = None
    maxPrice: Optional[float] = None
    limit:    int = 8

@app.post('/aivoy/tools/searchProducts')
async def search_products(req: Request):
    raw = await req.body()
    sig_header = req.headers.get('x-aivoy-signature', '')
    if not sig_header.startswith('t='): raise HTTPException(401)
    parts = dict(p.split('=') for p in sig_header.split(','))
    ts, sig = parts['t'], parts['v1']
    if abs(time.time() - int(ts)) > 300: raise HTTPException(401)

    expected = hmac.new(SECRET, f"{ts}.{raw.decode()}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected): raise HTTPException(401)

    body = await req.json()
    if body.get('tool') != 'searchProducts': raise HTTPException(400)
    args = Args(**body.get('args', {}))

    products = await db.fetch_products(
        query=args.query, category=args.category,
        max_price=args.maxPrice, limit=args.limit,
    )
    return [
        {
            'id':       p['id'],
            'title':    p['name'],
            'imageUrl': p['cover_image_url'],
            'price':    { 'amount': p['price_cents'] / 100, 'currency': p['currency'] },
            'href':     f"https://yourbrand.com/products/{p['slug']}",
        }
        for p in products
    ]`}</CodeBlock>

            <H3>Response shapes by use case</H3>
            <Table
              columns={['Tool intent', 'renderAs', 'Return shape']}
              rows={[
                ['Search products / listings', <><code className="code">listingCards</code> or <code className="code">productCards</code></>, <>Array of card objects (see <a href="#cards">Built-in cards</a>)</>],
                ['Open a single page', <code key="lk" className="code">link</code>, <>Single object: <code className="code">{`{ title, description?, href, imageUrl? }`}</code></>],
                ['Custom UI you ship', <>your <code className="code">cardType</code></>, <>Whatever shape your custom card component expects</>],
                ['Plain answer (e.g. "current order status")', <em key="none">none</em>, <>Any JSON. The LLM reads it and writes prose around it.</>],
              ]}
            />

            <H3>Helpful patterns</H3>
            <ul>
              <li>
                <b>Multi-tenant</b> — the request body has <code className="code">tenantId</code> and{' '}
                <code className="code">tokenId</code>. Use them to scope the query so a customer's
                concierge can only see their data. Don't trust <code className="code">args</code> to
                contain a tenant filter — set it server-side.
              </li>
              <li>
                <b>Errors</b> — return any non-2xx; aivoy surfaces it as <code className="code">tool_status: error</code>.
                Include a short <code className="code">error</code> field so the LLM can degrade
                gracefully (e.g. "I couldn't find that product").
              </li>
              <li>
                <b>Auth pass-through</b> — for tools that need the end-user's identity (e.g.{' '}
                <code className="code">cancelMyOrder</code>), look up the user via{' '}
                <code className="code">tokenId</code> + your own session table. End-user JWT
                pass-through is on the roadmap.
              </li>
              <li>
                <b>Latency</b> — aivoy gives webhooks 15 seconds. Cache hot queries on your side;
                avoid calling other slow APIs synchronously inside a tool. If you must, return a
                pending-state result and let a follow-up turn complete it.
              </li>
              <li>
                <b>Idempotency</b> — tool calls can repeat within a turn. For destructive operations
                (<code className="code">deleteOrder</code>), generate the idempotency key from{' '}
                <code className="code">tenantId + args</code> and de-dupe.
              </li>
            </ul>

            <H3>Test it locally</H3>
            <p>Sign + fire a request manually before wiring it to aivoy:</p>
            <CodeBlock>{`SECRET="whsec_..."           # from the dashboard
URL="http://localhost:3000/aivoy/tools/searchProducts"
BODY='{"tool":"searchProducts","args":{"query":"shoe","limit":3},"tenantId":"t","tokenId":"k"}'
TS=$(date +%s)
SIG=$(printf "%s.%s" "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -i -X POST "$URL" \\
  -H "Content-Type: application/json" \\
  -H "X-Aivoy-Signature: t=$TS,v1=$SIG" \\
  -d "$BODY"`}</CodeBlock>
            <p>
              Expect <code className="code">200</code> with a JSON array of products. If you get{' '}
              <code className="code">401</code>, your <code className="code">SECRET</code> doesn't
              match what's stored on the tenant. If you get a parse error, your raw-body capture
              isn't capturing pre-parsed bytes (re-read the warning callout above).
            </p>
          </Section>

          <Section id="chat-api">
            <H2>Chat API</H2>
            <CodeBlock>{`POST /embed/v1/chat
Authorization: Bearer pk_...
Origin: https://your-app.com
Content-Type: application/json

{ "messages": [{ "role": "user", "content": "..." }] }`}</CodeBlock>
            <p>Response is <code className="code">application/x-ndjson</code> — one JSON object per line. See <a href="#chunks">Stream chunks</a>.</p>
            <p>Headers on every response:</p>
            <ul>
              <li><code className="code">X-RateLimit-Limit</code> · <code className="code">X-RateLimit-Remaining</code> · <code className="code">X-RateLimit-Reset</code></li>
              <li><code className="code">Retry-After</code> on 429</li>
            </ul>
          </Section>

          <Section id="config-api">
            <H2>Config API</H2>
            <p>Used by the loader to bootstrap the widget — assistant name, greeting, suggested prompts, theme.</p>
            <CodeBlock>{`GET /embed/v1/config
Authorization: Bearer pk_...
Origin: https://your-app.com

→ {
  "assistant": {
    "name": "Concierge",
    "avatarUrl": null,
    "greeting": "Hi! How can I help?",
    "suggestedPrompts": ["Show me popular options"],
    "theme": { "accent": "#7c3aed" }
  }
}`}</CodeBlock>
          </Section>

          <Section id="chunks">
            <H2>Stream chunks</H2>
            <Table
              columns={['Type', 'Shape', 'Meaning']}
              rows={[
                [<code key="t" className="code">text</code>, <code key="ts" className="code">{`{ delta }`}</code>, 'Token-by-token assistant reply.'],
                [<code key="ts2" className="code">tool_status</code>, <code key="ts3" className="code">{`{ id, name, status, renderAs? }`}</code>, <>Emitted only on errors. Status is <code className="code">error</code>.</>],
                [<code key="c" className="code">card</code>, <code key="cs" className="code">{`{ cardType, data }`}</code>, 'Structured tool result rendered by the widget.'],
                [<code key="e" className="code">error</code>, <code key="es" className="code">{`{ error }`}</code>, 'Provider, webhook, or rate-limit error.'],
                [<code key="d" className="code">done</code>, <code key="ds" className="code">{`{}`}</code>, 'Turn finished.'],
              ]}
            />
          </Section>

          <Section id="cards">
            <H2>Built-in cards</H2>
            <p>Set <code className="code">renderAs</code> on a tool. Shapes are validated by zod — invalid data falls back to a JSON dump in a <code className="code">&lt;pre&gt;</code>.</p>

            <H3><code className="code">listingCards</code></H3>
            <p>Array of:</p>
            <CodeBlock>{`{
  id:        string | number;
  title:     string;
  subtitle?: string;
  imageUrl?: string;          // NB: a string URL, not an object
  price?:    { amount: number; currency: string; per?: string };
  rating?:   number;
  badges?:   string[];
  href?:     string;
}`}</CodeBlock>

            <H3><code className="code">productCards</code></H3>
            <CodeBlock>{`{
  id:        string | number;
  title:     string;
  imageUrl?: string;
  price?:    { amount: number; currency: string };
  href?:     string;
}`}</CodeBlock>

            <H3><code className="code">link</code></H3>
            <CodeBlock>{`{
  title:        string;
  description?: string;
  href:         string;
  imageUrl?:    string;
}`}</CodeBlock>

            <H3>Custom cards</H3>
            <p>The widget renders any tool result whose <code className="code">renderAs</code> matches one of the built-in types. To render <em>your own</em> shape, register a custom card. Two paths depending on how you embed.</p>

            <H4>From the script-tag embed (vanilla JS)</H4>
            <p>Set <code className="code">window.aivoyCards</code> before the loader runs. Each renderer receives the tool result <code className="code">data</code> and returns an HTML string or an <code className="code">HTMLElement</code>.</p>
            <CodeBlock>{`<script>
  window.aivoyCards = {
    eventCard: (data) => \`
      <a class="my-event" href="\${data.url}">
        <img src="\${data.poster}" alt="" />
        <strong>\${data.title}</strong>
        <span>\${data.dateLabel}</span>
      </a>
    \`,
    weather: (data) => {
      const el = document.createElement('div');
      el.className = 'my-weather';
      el.textContent = \`\${data.temp}° in \${data.city}\`;
      return el;
    },
  };
</script>
<script
  src="https://YOUR-AIVOY-HOST/embed/loader.js"
  data-token="pk_..."
  async
></script>`}</CodeBlock>
            <p>Then point a tool's <code className="code">renderAs</code> at <code className="code">eventCard</code> (or <code className="code">weather</code>) in the dashboard. Custom keys override built-ins, so you can replace <code className="code">listingCards</code> entirely if you want.</p>

            <H4>From a React app (npm package)</H4>
            <p>Pass typed React components via the <code className="code">cards</code> prop on <code className="code">&lt;Concierge&gt;</code>:</p>
            <CodeBlock>{`<Concierge
  cards={{
    flightOffer: ({ data }) => <FlightCard {...(data as Flight)} />,
    eventCard:   ({ data }) => <EventCard {...(data as Event)} />,
  }}
  ...
/>`}</CodeBlock>

            <Callout variant="info">
              The widget passes <code className="code">data</code> through unchanged — it's whatever your
              tool webhook returned. Validate the shape inside your renderer (or with zod) so a
              malformed response doesn't blow up the chat panel.
            </Callout>
          </Section>

          <Section id="origins">
            <H2>Origin allowlist</H2>
            <p>Every request is validated against the token's allowed origins. Format:</p>
            <ul>
              <li>Include the protocol — <code className="code">https://example.com</code>.</li>
              <li>No trailing slash, no path.</li>
              <li>List one per line, or comma-separated.</li>
              <li>The browser's <code className="code">Origin</code> header is compared exactly — different subdomains need separate entries.</li>
            </ul>
            <Callout variant="warning">
              Subdomain wildcards aren't supported on purpose — every origin you add is a third
              party that can spend your LLM budget. Keep the list tight.
            </Callout>
          </Section>

          <Section id="proxy">
            <H2>Reverse-proxy guide</H2>
            <p>
              For tighter brand control or to sidestep <code className="code">*.vercel.app</code> system mitigations, route the
              embed through a domain you control. Two common patterns:
            </p>

            <H3>Custom domain on the aivoy project</H3>
            <p>Easiest. Add <code className="code">embed.yourbrand.com</code> in your aivoy hosting dashboard, point DNS, and use that domain in <code className="code">data-host</code>. No code changes.</p>

            <H3>Cloudflare Worker (free)</H3>
            <p>If you can't add a custom domain, a Cloudflare Worker gives you a free <code className="code">*.workers.dev</code> origin and Cloudflare's edge caching:</p>
            <CodeBlock>{`// worker.js
const UPSTREAM = 'https://your-aivoy-host';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, UPSTREAM);
    return fetch(new Request(target.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    }));
  },
};`}</CodeBlock>
            <p>Browser sends <code className="code">Origin: https://yoursite.com</code> → Worker forwards as-is → aivoy validates against the token's allowlist. No changes needed on the token.</p>
          </Section>

          <Section id="troubleshooting">
            <H2>Troubleshooting</H2>
            <Table
              columns={['Symptom', 'Likely cause', 'Fix']}
              rows={[
                ['401 Invalid or revoked token', 'Token deleted or wrong tenant', 'Regenerate in dashboard'],
                ['403 Origin "…" not allowed', 'Site domain missing from allowlist', 'Add it in the token settings (exact match)'],
                ['429 Monthly message cap reached', 'Cap exceeded', 'Raise cap or wait for reset (header tells you when)'],
                ['Empty / malformed cards', 'Webhook returned a shape that doesn\'t match the card schema', 'Match the shapes under "Built-in cards"'],
                ['Widget loads but never opens', 'Token has no allowed origins set', 'Add at least the current page origin'],
                ['504 / hangs on chat', 'Webhook timing out (>15s)', 'Cache or pre-compute on your side; aivoy gives webhooks 15s'],
              ]}
            />
            <p className="muted text-sm" style={{ marginTop: 16 }}>
              Still stuck? Ping us with the response body of <code className="code">GET /embed/v1/config</code> using your token — that's enough to reproduce most issues.
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}

function DocsSidebarContent() {
  return (
    <>
      <Link
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px 16px',
          color: 'inherit',
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          a
        </span>
        aivoy docs
      </Link>

      <SidebarSection label="Get started">
        <SidebarLink href="#what-is-aivoy">What is aivoy?</SidebarLink>
        <SidebarLink href="#quickstart">5-minute quickstart</SidebarLink>
        <SidebarLink href="#install">Install the widget</SidebarLink>
        <SidebarLink href="#integrations">Framework recipes</SidebarLink>
      </SidebarSection>

      <SidebarSection label="Configure">
        <SidebarLink href="#assistant">Assistant</SidebarLink>
        <SidebarLink href="#providers">LLM providers</SidebarLink>
        <SidebarLink href="#tools">Tools</SidebarLink>
        <SidebarLink href="#tokens">Tokens</SidebarLink>
        <SidebarLink href="#theming">Theming</SidebarLink>
      </SidebarSection>

      <SidebarSection label="Reference">
        <SidebarLink href="#tool-webhook">Tool webhook contract</SidebarLink>
        <SidebarLink href="#build-webhook">Build a tool webhook</SidebarLink>
        <SidebarLink href="#chat-api">Chat API</SidebarLink>
        <SidebarLink href="#config-api">Config API</SidebarLink>
        <SidebarLink href="#chunks">Stream chunks</SidebarLink>
        <SidebarLink href="#cards">Built-in cards</SidebarLink>
      </SidebarSection>

      <SidebarSection label="Operations">
        <SidebarLink href="#origins">Origin allowlist</SidebarLink>
        <SidebarLink href="#proxy">Reverse-proxy guide</SidebarLink>
        <SidebarLink href="#troubleshooting">Troubleshooting</SidebarLink>
      </SidebarSection>
    </>
  );
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--muted)',
          letterSpacing: '0.08em',
          padding: '6px 8px',
        }}
      >
        {label.toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

function SidebarLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        padding: '5px 8px',
        borderRadius: 6,
        fontSize: 13,
        color: 'var(--fg-soft)',
        textDecoration: 'none',
      }}
    >
      {children}
    </a>
  );
}

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginTop: 56, scrollMarginTop: 24 }}>
      {children}
    </section>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ marginBottom: 12 }}>{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ marginTop: 24, marginBottom: 10 }}>{children}</h3>;
}

function H4({ children }: { children: React.ReactNode }) {
  return <h4 style={{ marginTop: 18, marginBottom: 8, fontSize: 14, color: 'var(--fg-soft)' }}>{children}</h4>;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      style={{
        margin: '12px 0',
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
        overflowX: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 12.5,
        lineHeight: 1.6,
        color: 'var(--fg)',
      }}
    >
      <code>{children}</code>
    </pre>
  );
}

function Callout({ children, variant = 'info' }: { children: React.ReactNode; variant?: 'info' | 'warning' | 'success' }) {
  return <div className={`callout callout-${variant}`} style={{ marginTop: 12 }}>{children}</div>;
}

function Table({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
  return (
    <div
      style={{
        margin: '12px 0',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg-subtle)' }}>
            {columns.map((col) => (
              <th
                key={col}
                style={{
                  textAlign: 'left',
                  padding: '10px 14px',
                  fontWeight: 500,
                  color: 'var(--muted)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '10px 14px', verticalAlign: 'top', color: 'var(--fg-soft)' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
