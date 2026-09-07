import { eventNames, readAttribution } from '@okinawa-care/content/attribution';

export interface Env {
  ASSETS: Fetcher;
  METRICS?: D1Database;
  METRICS_RATE_LIMITER?: RateLimit;
}

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow, noarchive' };
const reply = (status: number) => new Response(null, { status, headers });

async function recordEvent(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } });
  if (request.headers.get('Origin') !== new URL(request.url).origin) return reply(403);
  if (request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/json') return reply(415);
  if (Number(request.headers.get('Content-Length')) > 512) return reply(413);
  if (!env.METRICS || !env.METRICS_RATE_LIMITER) return reply(503);

  // One shared key per Cloudflare location avoids collecting user identifiers.
  const limit = await env.METRICS_RATE_LIMITER.limit({ key: 'recruitment-events' });
  if (!limit.success) return reply(429);

  // Enforce the real stream size even if Content-Length is missing or forged.
  const reader = request.body?.getReader();
  if (!reader) return reply(400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 512) { await reader.cancel(); return reply(413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body: unknown;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return reply(400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400);
  const data = body as Record<string, unknown>;
  if (Object.keys(data).sort().join(',') !== 'event,medium,source'
    || typeof data.event !== 'string' || !(eventNames as readonly string[]).includes(data.event)
    || typeof data.source !== 'string' || typeof data.medium !== 'string') return reply(400);
  const normalized = readAttribution(new URLSearchParams({ utm_source: data.source, utm_medium: data.medium }));
  if (normalized.source !== data.source || normalized.medium !== data.medium) return reply(400);

  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
  await env.METRICS.prepare(`INSERT INTO daily_events (day, source, medium, event, count)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(day, source, medium, event) DO UPDATE SET count = count + 1`)
    .bind(day, normalized.source, normalized.medium, data.event).run();
  return reply(204);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/api/health') return Response.json({ status: 'ok' }, { headers });
    if (pathname === '/api/events') {
      try { return await recordEvent(request, env); } catch { return reply(503); }
    }
    if (pathname.startsWith('/api/')) return reply(404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
