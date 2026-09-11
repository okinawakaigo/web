import recruit, { type Env } from './index';
import dashboard, { type DashboardEnv } from './dashboard-worker';
import { loopback } from './http';

type LocalEnv = Env & DashboardEnv;
// One local runtime and one asset binding avoid collisions between app previews.
// This entrypoint is never included in a production deployment.
function scopedAssets(assets: Fetcher, prefix: string): Fetcher {
  return {
    async fetch(input: RequestInfo | URL, init?: RequestInit) {
      const request = new Request(input, init); const url = new URL(request.url);
      url.pathname = `/${prefix}${url.pathname}`;
      const result = await assets.fetch(new Request(url, request));
      const location = result.headers.get('Location');
      if (!location) return result;
      const redirect = new URL(location, url);
      if (redirect.pathname.startsWith(`/${prefix}/`)) redirect.pathname = redirect.pathname.slice(prefix.length + 1);
      const response = new Response(result.body, result); response.headers.set('Location', redirect.href); return response;
    },
  } as Fetcher;
}
export default {
  fetch(request: Request, env: LocalEnv, ctx: ExecutionContext): Response | Promise<Response> {
    const url = new URL(request.url);
    if (!loopback(url)) return new Response('Local preview only', { status: 403 });
    if (request.headers.get('x-local-app') === 'dashboard') {
      const origin = new URL(request.headers.get('x-local-origin') ?? request.url);
      if (!loopback(origin) || origin.protocol !== 'http:') return new Response('Local preview only', { status: 403 });
      url.host = origin.host;
      const forwarded = new Request(url, request);
      forwarded.headers.delete('x-local-app'); forwarded.headers.delete('x-local-origin');
      return dashboard.fetch(forwarded, { ...env, ASSETS: scopedAssets(env.ASSETS, 'dashboard') }, ctx);
    }
    return recruit.fetch(request, { ...env, ASSETS: scopedAssets(env.ASSETS, 'recruit') }, ctx);
  },
} satisfies ExportedHandler<LocalEnv>;
