import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { assertDenied } from './verify-response.mjs';
import { hasBasicAuthCredentials } from '../src/basic-auth.ts';
const origin = new URL(process.env.DASHBOARD_VERIFY_URL ?? process.env.ADMIN_VERIFY_URL ?? 'https://dashboard.okinawakaigo.com');
assert(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) || origin.origin === 'https://dashboard.okinawakaigo.com');
assert(hasBasicAuthCredentials({ BASIC_AUTH_USERNAME: process.env.ADMIN_USERNAME, BASIC_AUTH_PASSWORD: process.env.ADMIN_PASSWORD }), 'Admin credentials are required');
const auth = user => `Basic ${Buffer.from(`${process.env[`${user}_USERNAME`]}:${process.env[`${user}_PASSWORD`]}`).toString('base64')}`;
const files = readdirSync(new URL('../../dashboard/dist/', import.meta.url), { recursive: true });
const assets = ['.css', '.js', '.woff2'].map(extension => {
  const file = files.find(file => file.endsWith(extension));
  assert(file, `Missing dashboard asset: ${extension}`); return [`/${file}`, 200];
});
for (const [path, status] of [['/', 200], ...assets, ['/api/consultations', 200], ['/design/', 404]]) {
  for (const authorization of ['', auth('BASIC_AUTH'), auth('ADMIN')]) {
    const response = await fetch(new URL(path, origin), { headers: authorization ? { Authorization: authorization } : {}, redirect: 'manual', signal: AbortSignal.timeout(10000) });
    assert.match(response.headers.get('Cache-Control') ?? '', /no-store/);
    assert.match(response.headers.get('X-Robots-Tag') ?? '', /noindex/);
    if (authorization === auth('ADMIN')) assert.equal(response.status, status, `Admin ${path}`);
    else await assertDenied(response, path);
    await response.body?.cancel();
  }
}
console.log('Dashboard authentication, API, assets and design-guide exclusion verified.');
