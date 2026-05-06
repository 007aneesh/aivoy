/**
 * Standalone IIFE bundle. Loaded by the cloud's <script src="…/embed/loader.js">.
 * Bundles React + ReactDOM + the widget so a host site does NOT need React.
 *
 * Exposes `window.Aivoy.mount({ token, host, target?, theme? })`.
 */
import { createRoot, type Root } from 'react-dom/client';
import { Concierge } from './ui/Concierge';
import { proxyAdapter } from './adapters/proxy';
import type { ThemeConfig } from './core/types';
import styles from './ui/styles.css?inline';

interface MountOptions {
  /** Public token (`pk_…`). Required. */
  token: string;
  /** aivoy cloud base URL. Defaults to the script's own origin. */
  host?: string;
  /** Where to mount. CSS selector, element, or omitted (creates a div on body). */
  target?: string | HTMLElement;
  /** Theme overrides applied on top of the assistant's saved theme. */
  theme?: ThemeConfig;
}

interface AssistantConfigPayload {
  name: string;
  avatarUrl?: string | null;
  greeting?: string | null;
  suggestedPrompts?: string[];
  theme?: ThemeConfig;
}

const STYLE_ID = 'aivoy-styles';
const ROOT_ID = 'aivoy-root';

const mounted = new Map<HTMLElement, Root>();

async function mount(opts: MountOptions): Promise<void> {
  if (typeof document === 'undefined') return;
  if (!opts.token) throw new Error('Aivoy.mount: token is required');

  const host = (opts.host ?? deriveHostFromCurrentScript() ?? '').replace(/\/$/, '');
  if (!host) {
    throw new Error('Aivoy.mount: host could not be derived; pass it explicitly');
  }

  injectStyles();
  const container = resolveContainer(opts.target);
  if (mounted.has(container)) {
    // Re-mount safely.
    mounted.get(container)!.unmount();
    mounted.delete(container);
  }

  const config = await fetchConfig(host, opts.token);
  const theme = { ...(config.theme ?? {}), ...(opts.theme ?? {}) };

  const adapter = proxyAdapter({
    url: `${host}/api/v1/chat`,
    headers: () => ({ Authorization: `Bearer ${opts.token}` }),
  });

  const root = createRoot(container);
  mounted.set(container, root);

  root.render(
    <Concierge
      adapter={adapter}
      assistant={{
        name: config.name,
        avatarUrl: config.avatarUrl ?? undefined,
        greeting: config.greeting ?? undefined,
        suggestedPrompts: config.suggestedPrompts ?? [],
      }}
      theme={theme}
      persistence={{ strategy: 'local', key: `aivoy:${opts.token.slice(0, 12)}` }}
    />,
  );
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = styles as unknown as string;
  document.head.appendChild(style);
}

function resolveContainer(target?: MountOptions['target']): HTMLElement {
  if (typeof target === 'string') {
    const el = document.querySelector<HTMLElement>(target);
    if (el) return el;
  } else if (target instanceof HTMLElement) {
    return target;
  }
  let existing = document.getElementById(ROOT_ID);
  if (!existing) {
    existing = document.createElement('div');
    existing.id = ROOT_ID;
    document.body.appendChild(existing);
  }
  return existing;
}

async function fetchConfig(host: string, token: string): Promise<AssistantConfigPayload> {
  const url = `${host}/api/v1/config?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Aivoy.mount: config fetch failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { assistant?: AssistantConfigPayload };
  return (
    json.assistant ?? {
      name: 'Assistant',
    }
  );
}

function deriveHostFromCurrentScript(): string | null {
  if (typeof document === 'undefined') return null;
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>('script[data-aivoy-host]');
  const explicit = script?.dataset.aivoyHost;
  if (explicit) return explicit;
  const src = script?.src;
  if (src) {
    try {
      return new URL(src).origin;
    } catch {
      // ignore
    }
  }
  return null;
}

declare global {
  interface Window {
    Aivoy?: {
      mount: (opts: MountOptions) => Promise<void>;
    };
  }
}

if (typeof window !== 'undefined') {
  window.Aivoy = { mount };

  // Auto-mount: if we were loaded via <script src="…" data-token="pk_…">, mount immediately.
  const auto = (document.currentScript as HTMLScriptElement | null) ?? null;
  const autoToken = auto?.dataset.token;
  if (autoToken) {
    void mount({
      token: autoToken,
      host: auto?.dataset.host ?? undefined,
      target: auto?.dataset.target ?? undefined,
    }).catch((err) => {
      console.error('[aivoy] auto-mount failed:', err);
    });
  }
}

export {};
