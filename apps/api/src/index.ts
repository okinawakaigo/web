import { Hono } from 'hono';
import { requireBasicAuth, type BasicAuthEnv } from './basic-auth';
import { privateResponse, privateHeaders } from './response-headers';
import { receiveConsultation, type IntakeEnv } from './intake';
import { errorResponse, loopback } from './http';
import { recordEvent } from './metrics';

export interface Env extends BasicAuthEnv, IntakeEnv {
  ASSETS: Fetcher;
  METRICS?: D1Database;
  METRICS_RATE_LIMITER?: RateLimit;
}

export function createRecruitApp({ localPreview = false }: { localPreview?: boolean } = {}) {
  const app = new Hono<{ Bindings: Env }>();
  app.use('*', async (c, next) => {
    await next();
    for (const [name, value] of Object.entries(privateHeaders(new URL(c.req.url)))) c.header(name, value);
  });
  app.use('*', async (c, next) => {
    const url = new URL(c.req.url);
    // Only the local entrypoint opts in; production always requires authentication.
    if (localPreview && loopback(url)) { await next(); return; }
    if (url.protocol === 'http:' && !loopback(url)) {
      url.protocol = 'https:'; return Response.redirect(url.href, 308);
    }
    const denied = requireBasicAuth(c.req.raw, c.env);
    if (denied) return denied;
    await next();
  });
  app.get('/api/health', c => c.json({ status: 'ok' }));
  app.all('/api/consultations', c => {
    // Hono has no execution context in direct Node tests. Runtime requests have one.
    let ctx: Pick<ExecutionContext, 'waitUntil'> | undefined;
    try { ctx = c.executionCtx; } catch { /* Await notifications in direct tests. */ }
    return receiveConsultation(c.req.raw, c.env, ctx);
  });
  app.all('/api/events', async c => {
    try { return await recordEvent(c.req.raw, c.env); }
    catch { return new Response(null, { status: 503 }); }
  });
  app.all('/api/*', () => new Response(null, { status: 404 }));
  app.all('*', c => {
    const request = new Request(c.req.raw); request.headers.delete('Authorization');
    return c.env.ASSETS.fetch(request);
  });
  app.onError((error, c) => privateResponse(errorResponse(error), new URL(c.req.url)));
  return app;
}
export default createRecruitApp();
