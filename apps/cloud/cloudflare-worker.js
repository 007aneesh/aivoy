/**
 * Cloudflare Worker — transparent proxy in front of aivoy.vercel.app.
 *
 * Why: Vercel's free-tier `*.vercel.app` system mitigations flag cross-site
 * script loads from third-party customer origins, returning 403 with
 * `x-vercel-mitigated: deny`. Custom Firewall Rules on Hobby don't override
 * those system mitigations.
 *
 * This Worker exposes a `*.workers.dev` subdomain (free, no domain needed)
 * that customers integrate with instead. Cloudflare has no equivalent
 * cross-site WAF, and Vercel sees the Worker as server-to-server traffic
 * from Cloudflare's edge IPs — neither side denies the traffic.
 *
 * Free tier: 100,000 requests/day. Long-term, replace with a real custom
 * domain on the aivoy Vercel project.
 *
 * Deploy:
 *   npx wrangler deploy
 *
 * Or paste this code into the Cloudflare dashboard's Worker editor.
 */

const UPSTREAM = 'https://aivoy.vercel.app';

export default {
  /** @param {Request} request */
  async fetch(request) {
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, UPSTREAM);

    // Forward the request as-is. Browser-set headers (Origin, Referer,
    // Authorization, cookies, etc.) flow through untouched, which is exactly
    // what aivoy's token-origin check expects.
    const upstreamReq = new Request(target.toString(), {
      method: request.method,
      headers: request.headers,
      body:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : request.body,
      redirect: 'manual',
    });

    const upstream = await fetch(upstreamReq);

    // Pass the response through. Cloudflare handles transfer encoding
    // automatically, so unlike the Node-fetch case we don't need to scrub
    // content-encoding headers.
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: upstream.headers,
    });
  },
};
