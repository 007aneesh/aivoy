/**
 * Standalone IIFE bundle. Loaded by the cloud's <script src="…/embed/loader.js">.
 * Bundles React + ReactDOM + the widget so a host site does NOT need React.
 *
 * Exposes `window.Aivoy.mount({ token, host, target?, theme?, cards? })`.
 *
 * Custom cards from non-React sites:
 *
 *   <script>
 *     window.aivoyCards = {
 *       eventCard: (data) => `<a class="my-event" href="${data.url}">${data.title}</a>`,
 *       // OR return an HTMLElement:
 *       // weather: (data) => { const el=document.createElement('div'); el.textContent=data.temp; return el; }
 *     };
 *   </script>
 *   <script src="…/embed/loader.js" data-token="pk_…" async></script>
 */
import { createElement, useEffect, useRef, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { z } from 'zod';
import { Concierge } from './ui/Concierge';
import { proxyAdapter } from './adapters/proxy';
import { defineTool, type ThemeConfig, type Tool } from './core/types';
import styles from './ui/styles.css?inline';

type VanillaCardRenderer = (data: unknown) => string | HTMLElement | null | undefined;

interface MountOptions {
  /** Public token (`pk_…`). Required. */
  token: string;
  /** aivoy cloud base URL. Defaults to the script's own origin. */
  host?: string;
  /** Where to mount. CSS selector, element, or omitted (creates a div on body). */
  target?: string | HTMLElement;
  /** Theme overrides applied on top of the assistant's saved theme. */
  theme?: ThemeConfig;
  /**
   * Custom card renderers keyed by `cardType`. Each takes the tool result
   * `data` and returns an HTML string OR an HTMLElement. Overrides built-in
   * cards (`listingCards`, `productCards`, `link`) when keys match.
   */
  cards?: Record<string, VanillaCardRenderer>;
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
    url: `${host}/embed/v1/chat`,
    headers: () => ({ Authorization: `Bearer ${opts.token}` }),
  });

  const root = createRoot(container);
  mounted.set(container, root);

  const cards = buildCardComponents({
    ...readGlobalCards(),
    ...(opts.cards ?? {}),
  })

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
      cards={cards}
      tools={builtinClientTools()}
      persistence={{ strategy: 'local', key: `aivoy:${opts.token.slice(0, 12)}` }}
    />,
  );
}

function readGlobalCards(): Record<string, VanillaCardRenderer> {
  if (typeof window === 'undefined') return {};
  const fromGlobal = (window as unknown as { aivoyCards?: unknown }).aivoyCards;
  if (!fromGlobal || typeof fromGlobal !== 'object') return {};
  const out: Record<string, VanillaCardRenderer> = {};
  for (const [k, v] of Object.entries(fromGlobal as Record<string, unknown>)) {
    if (typeof v === 'function') out[k] = v as VanillaCardRenderer;
  }
  return out;
}

function buildCardComponents(
  vanilla: Record<string, VanillaCardRenderer>,
): Record<string, ComponentType<{ data: unknown }>> {
  const out: Record<string, ComponentType<{ data: unknown }>> = {};
  for (const [type, render] of Object.entries(vanilla)) {
    out[type] = function VanillaCardWrapper({ data }: { data: unknown }) {
      const ref = useRef<HTMLDivElement>(null);
      useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const result = render(data);
        el.innerHTML = '';
        if (result == null) return;
        if (typeof result === 'string') el.innerHTML = result;
        else if (result instanceof HTMLElement) el.appendChild(result);
      }, [data]);
      return createElement('div', { className: 'aivoy-card-custom', ref });
    };
  }
  return out;
}

/**
 * Built-in tools the WIDGET runs locally (browser-only capabilities the
 * cloud cannot perform). Cached per-mount: the geolocation prompt fires
 * the first time the LLM asks; subsequent calls reuse the same fix.
 */
let cachedGeo: { lat: number; lng: number; capturedAt: number } | null = null;

function builtinClientTools(): Tool<any, any>[] {
  return [
    defineTool({
      name: 'getUserLocation',
      description:
        "Get the current user's approximate geographic location (latitude/longitude) " +
        'via the browser. Use this whenever the user asks for "nearby" results or ' +
        'mentions their current location without naming a city. Triggers a one-time ' +
        'browser permission prompt; if denied or unavailable, returns an error and ' +
        'you should ASK the user to type a city instead. Do NOT call repeatedly.',
      input: z.object({}).strict(),
      run: async () => {
        if (cachedGeo && Date.now() - cachedGeo.capturedAt < 30 * 60_000) {
          return { lat: cachedGeo.lat, lng: cachedGeo.lng, source: 'cache' as const };
        }
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          throw new Error('geolocation unavailable in this browser');
        }
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 10_000,
            maximumAge: 5 * 60_000,
          });
        }).catch((e: GeolocationPositionError | Error) => {
          const msg =
            'code' in e
              ? e.code === 1
                ? 'permission denied'
                : e.code === 2
                  ? 'position unavailable'
                  : e.code === 3
                    ? 'timeout'
                    : 'unknown geolocation error'
              : e.message;
          throw new Error(msg);
        });
        cachedGeo = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          capturedAt: Date.now(),
        };
        return { lat: cachedGeo.lat, lng: cachedGeo.lng, source: 'browser' as const };
      },
    }),
  ];
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
  // Token goes in the Authorization header (matching /embed/v1/chat) so
  // it never leaks into URLs, server access logs, referrers, or CDN
  // analytics. Same auth shape as the chat endpoint, one mental model.
  const res = await fetch(`${host}/embed/v1/config`, {
    credentials: 'omit',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Aivoy.mount: config fetch failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { assistant?: AssistantConfigPayload };
  return (
    json.assistant ?? {
      name: 'Ask Aivoy',
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
