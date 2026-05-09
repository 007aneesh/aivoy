import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';

export default function HomePage() {
  return (
    <>
      <Header />
      <main style={{ maxWidth: 880, margin: '0 auto', padding: 'clamp(40px, 8vw, 64px) clamp(20px, 4vw, 40px) 96px' }}>
        <h1
          style={{
            fontSize: 'clamp(32px, 8vw, 56px)',
            lineHeight: 1.05,
            margin: 0,
            letterSpacing: -1,
          }}
        >
          AI concierge.
          <br />
          One script tag.
        </h1>
        <p
          style={{
            color: 'var(--muted)',
            fontSize: 'clamp(15px, 2.4vw, 19px)',
            marginTop: 18,
            maxWidth: 580,
            lineHeight: 1.5,
          }}
        >
          Drop a streaming chatbot into any web app. Pick a model, paste your
          key, register your data sources as webhooks. We handle the streaming,
          the tool calls, and the rate limits.
        </p>

        <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <SignedOut>
            <Link
              href="/sign-up"
              style={{
                background: 'var(--accent)',
                color: 'white',
                padding: '12px 22px',
                borderRadius: 8,
                fontWeight: 500,
              }}
            >
              Get started — free
            </Link>
            <Link
              href="/docs"
              style={{
                border: '1px solid var(--border)',
                padding: '12px 22px',
                borderRadius: 8,
                color: 'inherit',
              }}
            >
              Read the docs →
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              style={{
                background: 'var(--accent)',
                color: 'white',
                padding: '12px 22px',
                borderRadius: 8,
                fontWeight: 500,
              }}
            >
              Open dashboard
            </Link>
            <Link
              href="/docs"
              style={{
                border: '1px solid var(--border)',
                padding: '12px 22px',
                borderRadius: 8,
                color: 'inherit',
              }}
            >
              Docs
            </Link>
          </SignedIn>
        </div>

        <section style={{ marginTop: 72 }}>
          <Snippet />
        </section>

        <section style={{ marginTop: 72 }}>
          <h2 style={{ fontSize: 24, margin: '0 0 24px' }}>Why aivoy</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
            }}
          >
            <Feature
              title="Bring your own model"
              body="OpenAI, Anthropic, Gemini, Grok, Groq. Swap models without touching tenant code. Keys are sealed AES-256-GCM at rest."
            />
            <Feature
              title="Tools as webhooks"
              body="Your data stays on your servers. We POST signed requests to your endpoints; you reply with JSON the LLM understands."
            />
            <Feature
              title="Rich cards out of the box"
              body="Tools can render results as listing, product, or link cards — not just plain text."
            />
            <Feature
              title="One-line install"
              body="A script tag. No npm, no React peer dependency. Or use the React component if you prefer."
            />
            <Feature
              title="Origin-locked tokens"
              body="Per-token allowed-origins list. Stolen tokens can't be reused on another domain."
            />
            <Feature
              title="Usage you can see"
              body="Per-token monthly caps, 30-day charts, real-time event feed. 429 with Retry-After when you're over."
            />
          </div>
        </section>

        <section style={{ marginTop: 72 }}>
          <h2 style={{ fontSize: 24, margin: '0 0 16px' }}>FAQ</h2>
          <Faq
            q="Does it really work without npm?"
            a="Yes — the script tag loads a self-contained bundle (~85 KB gzipped including React). Auto-mounts on load."
          />
          <Faq
            q="What happens if my model key leaks?"
            a="It can't — the only place it ever exists in plaintext is in transit between your dashboard form and our memory during a single chat request. Stolen browser-side tokens have an origin allowlist."
          />
          <Faq
            q="Can I bring my own UI?"
            a={
              <>
                Yes. Use the headless <code>useConcierge()</code> hook from the npm package
                and render whatever you want.
              </>
            }
          />
          <Faq
            q="How is this priced?"
            a="Free during the v1 beta — pricing is being finalised. Caps prevent surprise bills."
          />
        </section>
      </main>
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: 13,
        }}
      >
        <Link href="/docs" style={{ color: 'inherit', marginRight: 16 }}>Docs</Link>
        <Link href="/dashboard" style={{ color: 'inherit', marginRight: 16 }}>Dashboard</Link>
        <span>· aivoy</span>
      </footer>
    </>
  );
}

function Header() {
  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <Link href="/" style={{ fontWeight: 700, fontSize: 18, color: 'inherit' }}>
        aivoy
      </Link>
      <nav style={{ display: 'flex', gap: 16, fontSize: 14 }}>
        <Link href="/docs" style={{ color: 'inherit' }}>Docs</Link>
        <SignedOut>
          <Link href="/sign-in" style={{ color: 'inherit' }}>Sign in</Link>
        </SignedOut>
        <SignedIn>
          <Link href="/dashboard" style={{ color: 'var(--accent)', fontWeight: 500 }}>
            Dashboard
          </Link>
        </SignedIn>
      </nav>
    </header>
  );
}

function Snippet() {
  const code = `<script
  src="https://aivoy.dev/embed/loader.js"
  data-token="pk_..."
  async></script>`;
  return (
    <div
      style={{
        background: '#0f0f12',
        color: '#f4f4f5',
        padding: 24,
        borderRadius: 12,
        fontSize: 13,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        whiteSpace: 'pre',
        overflowX: 'auto',
      }}
    >
      {code}
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 18,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <details
      style={{
        borderBottom: '1px solid var(--border)',
        padding: '14px 0',
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 500 }}>{q}</summary>
      <div style={{ color: 'var(--muted)', marginTop: 8, fontSize: 14 }}>{a}</div>
    </details>
  );
}
