// Mock tenant webhook for testing /api/v1/chat tool dispatch.
// Verifies the X-Aivoy-Signature header (HMAC-SHA256 of `${ts}.${body}`).
// Returns a small list of fake Paris stays.
//
// Usage:
//   AIVOY_WEBHOOK_SECRET=whsec_xxx node scripts/mock-webhook.mjs

import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 4111);
const SECRET = process.env.AIVOY_WEBHOOK_SECRET;
if (!SECRET) {
  console.error('AIVOY_WEBHOOK_SECRET is required');
  process.exit(1);
}

const FAKE_LISTINGS = [
  {
    id: 1,
    title: 'Sunlit Studio in Le Marais',
    subtitle: 'Paris • 1 guest • Wi-Fi',
    imageUrl: 'https://example.com/p1.jpg',
    price: { amount: 89, currency: 'EUR', per: 'night' },
    rating: 4.8,
    badges: ['Superhost', 'Free cancel'],
  },
  {
    id: 2,
    title: 'Cozy Loft near Canal Saint-Martin',
    subtitle: 'Paris • 1 guest • Kitchen',
    imageUrl: 'https://example.com/p2.jpg',
    price: { amount: 72, currency: 'EUR', per: 'night' },
    rating: 4.6,
  },
];

function verifySig(rawBody, header) {
  if (!header) return false;
  const m = /^t=(\d+),v1=([0-9a-f]+)$/.exec(header);
  if (!m) return false;
  const [, ts, sig] = m;
  const expected = createHmac('sha256', SECRET).update(`${ts}.${rawBody}`).digest('hex');
  // timingSafeEqual requires equal-length buffers
  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

const server = createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end('method not allowed');
    return;
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');

  const sigHeader = req.headers['x-aivoy-signature'];
  const sigOk = verifySig(raw, Array.isArray(sigHeader) ? sigHeader[0] : sigHeader);

  console.log(`[webhook] ${req.url} sig=${sigOk ? 'ok' : 'BAD'} body=${raw.slice(0, 200)}`);

  if (!sigOk) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'bad signature' }));
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    res.writeHead(400).end('bad json');
    return;
  }

  if (parsed.tool === 'searchListings') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(FAKE_LISTINGS));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: `unknown tool: ${parsed.tool}` }));
});

server.listen(PORT, () => {
  console.log(`[webhook] listening on http://localhost:${PORT}`);
});
