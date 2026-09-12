import { spawn } from 'node:child_process';
import { createServer, request as proxyRequest } from 'node:http';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
const port = process.env.PREVIEW_PORT ?? '8787';
const dashboardPort = process.env.DASHBOARD_PORT ?? process.env.ADMIN_PORT ?? '8788';
for (const value of [port, dashboardPort]) {
  if (!/^\d+$/.test(value) || Number(value) < 1024 || Number(value) > 65535) throw new Error('Preview ports must be between 1024 and 65535.');
}
if (port === dashboardPort) throw new Error('Use different site and dashboard ports.');
// Both URLs use one Wrangler runtime so D1 has a single SQLite owner locally.
const proxy = createServer((request, response) => {
  const upstream = proxyRequest({ hostname: '127.0.0.1', port, path: request.url, method: request.method,
    headers: { ...request.headers, host: `127.0.0.1:${port}`, 'x-local-app': 'dashboard', 'x-local-origin': `http://${request.headers.host}` } }, result => {
      response.writeHead(result.statusCode ?? 503, result.headers); result.pipe(response);
    });
  upstream.on('error', () => { if (!response.headersSent) response.writeHead(503); response.end('Local preview is starting. Please reload.'); });
  request.on('aborted', () => upstream.destroy()); request.pipe(upstream);
});
const assets = new URL('../apps/api/.wrangler/preview-assets/', import.meta.url);
rmSync(assets, { recursive: true, force: true }); mkdirSync(assets, { recursive: true });
for (const app of ['recruit', 'dashboard']) cpSync(new URL(`../apps/${app}/dist/`, import.meta.url), new URL(app, assets), { recursive: true });
cpSync(new URL('../apps/recruit/dist/404.html', import.meta.url), new URL('404.html', assets));
const child = spawn('pnpm', ['--filter', '@okinawa-care/api', 'exec', 'wrangler', 'dev',
  '-c', 'wrangler.local.jsonc',
  '--local', '--ip', '127.0.0.1', '--port', port, '--persist-to', '.wrangler/state'],
{ stdio: 'inherit', detached: process.platform !== 'win32' });
function stop() {
  proxy.close(); proxy.closeAllConnections();
  try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM'); else child.kill('SIGTERM'); }
  catch { /* Already stopped. */ }
}
proxy.on('error', error => { console.error(error.message); process.exitCode = 1; stop(); });
proxy.listen(Number(dashboardPort), '127.0.0.1', () => console.log(`Recruit: http://127.0.0.1:${port}/\nDashboard: http://127.0.0.1:${dashboardPort}/`));
child.on('error', () => { process.exitCode = 1; stop(); });
child.on('exit', code => { process.exitCode = code ?? 0; proxy.close(); proxy.closeAllConnections(); });
process.on('SIGINT', stop); process.on('SIGTERM', stop);
