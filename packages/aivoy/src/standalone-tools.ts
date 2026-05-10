/**
 * Built-in browser-capability tools the standalone widget can expose to the
 * LLM. A tenant opts in by listing names in their assistant's
 * `enabledClientTools` (cloud DB). The widget reads that list from
 * `/embed/v1/config` and registers matching entries — tenants do NOT
 * inject `<script>` boilerplate to get a basic capability working.
 *
 * Power users still can — `window.aivoyClientTools` is merged in by name
 * (host injection wins on conflict). Add new capabilities here as the
 * surface grows (clipboard, share, file picker, etc.).
 */
import type { Tool } from './core/types';

let geoCache: { lat: number; lng: number; t: number } | null = null;

const BUILTINS: Record<string, () => Tool<any, any>> = {
  getUserLocation: () => ({
    name: 'getUserLocation',
    description:
      'Get the user latitude/longitude via the browser. Use when the user asks for "nearby" results or mentions their current location without naming a city. Triggers a one-time browser permission prompt.',
    parameters: { type: 'object', properties: {} },
    run: async () => {
      if (geoCache && Date.now() - geoCache.t < 30 * 60_000) {
        return { lat: geoCache.lat, lng: geoCache.lng, source: 'cache' as const };
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
                  : 'geolocation error'
            : e.message;
        throw new Error(msg);
      });
      geoCache = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        t: Date.now(),
      };
      return { lat: geoCache.lat, lng: geoCache.lng, source: 'browser' as const };
    },
  }),
};

/** Resolve enabled built-in tool names to fresh Tool instances. Unknown
 *  names are silently skipped — keeps the cloud free to enable a name
 *  before the widget has shipped its implementation. */
export function resolveBuiltinClientTools(names: string[]): Tool<any, any>[] {
  const seen = new Set<string>();
  const out: Tool<any, any>[] = [];
  for (const n of names) {
    if (seen.has(n)) continue;
    seen.add(n);
    const factory = BUILTINS[n];
    if (factory) out.push(factory());
  }
  return out;
}
