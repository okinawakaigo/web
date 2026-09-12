import { createRecruitApp, type Env } from './index';
import { createDashboardApp, type DashboardEnv } from './dashboard-worker';
import { loopback, loopbackRequest } from './http';

type LocalEnv = Env & DashboardEnv;
const recruit = createRecruitApp({ localPreview: true });
const dashboard = createDashboardApp({ localPreview: true });
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
const localOnly = () => new Response('Local preview only', { status: 403 });
export default {
  fetch(request: Request, env: LocalEnv, ctx: ExecutionContext): Response | Promise<Response> {
    if (!loopbackRequest(request)) return localOnly();
    const url = new URL(request.url);
    if (request.headers.get('x-local-app') === 'dashboard') {
      const origin = new URL(request.headers.get('x-local-origin') ?? request.url);
      if (!loopback(origin) || origin.protocol !== 'http:') return localOnly();
      url.host = origin.host;
      const forwarded = new Request(url, request);
      forwarded.headers.delete('x-local-app'); forwarded.headers.delete('x-local-origin');
      return dashboard.fetch(forwarded, { ...env, ASSETS: scopedAssets(env.ASSETS, 'dashboard') }, ctx);
    }
    return recruit.fetch(request, { ...env, ASSETS: scopedAssets(env.ASSETS, 'recruit') }, ctx);
  },
} satisfies ExportedHandler<LocalEnv>;
