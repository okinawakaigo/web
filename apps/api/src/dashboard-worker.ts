import { Hono } from 'hono';
import { requireBasicAuth, hasBasicAuthCredentials } from './basic-auth';
import { privateResponse, privateHeaders } from './response-headers';
import { adminConsultations, type ConsultationEnv } from './consultations';
import { errorResponse, loopback } from './http';
import { consultationReplies, type ReplyEnv } from './replies';

export interface DashboardEnv extends ConsultationEnv, ReplyEnv {
  ASSETS: Fetcher;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_RATE_LIMITER?: RateLimit;
}

const app = new Hono<{ Bindings: DashboardEnv }>();
app.use('*', async (c, next) => {
  await next();
  for (const [name, value] of Object.entries(privateHeaders(new URL(c.req.url)))) c.header(name, value);
});
app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  if (url.protocol === 'http:' && !loopback(url)) { url.protocol = 'https:'; return Response.redirect(url.href, 308); }
  const credentials = { BASIC_AUTH_USERNAME: c.env.ADMIN_USERNAME, BASIC_AUTH_PASSWORD: c.env.ADMIN_PASSWORD };
  if (!hasBasicAuthCredentials(credentials) || (!c.env.ADMIN_RATE_LIMITER && !loopback(url))) return new Response('Service unavailable', { status: 503 });
  if (c.env.ADMIN_RATE_LIMITER && !(await c.env.ADMIN_RATE_LIMITER.limit({ key: 'admin-access' })).success) return new Response('Too many requests', { status: 429 });
  const denied = requireBasicAuth(c.req.raw, credentials, 'Okinawa Care Dashboard');
  if (denied) return denied;
  await next();
});
app.get('/api/consultations', c => adminConsultations(c.req.raw, c.env));
app.get('/api/consultations/:id', c => adminConsultations(c.req.raw, c.env));
app.patch('/api/consultations/:id', c => adminConsultations(c.req.raw, c.env));
app.post('/api/consultations/:id/notify', c => adminConsultations(c.req.raw, c.env));
app.get('/api/consultations/:id/replies', c => consultationReplies(c.req.raw, c.env));
app.post('/api/consultations/:id/replies', c => consultationReplies(c.req.raw, c.env));
app.post('/api/consultations/:id/replies/:replyId/retry', c => consultationReplies(c.req.raw, c.env));
app.all('/api/*', () => new Response(null, { status: 404 }));
app.all('*', c => {
  const request = new Request(c.req.raw); request.headers.delete('Authorization');
  return c.env.ASSETS.fetch(request);
});
app.onError((error, c) => privateResponse(errorResponse(error), new URL(c.req.url)));
export default app;
