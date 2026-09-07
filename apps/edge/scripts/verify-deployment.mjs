import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { hasBasicAuthCredentials } from '../src/basic-auth.ts';

const origin = new URL(process.env.RECRUIT_VERIFY_URL ?? 'https://recruit.okinawakaigo.com');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
assert(local || origin.origin === 'https://recruit.okinawakaigo.com', 'Unexpected verification origin');
assert(hasBasicAuthCredentials(process.env), 'Basic authentication secrets are required');
const authorization = `Basic ${Buffer.from(`${process.env.BASIC_AUTH_USERNAME}:${process.env.BASIC_AUTH_PASSWORD}`).toString('base64')}`;

async function get(path, auth) {
  return fetch(new URL(path, origin), {
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
    headers: auth ? { Authorization: auth } : {},
  });
}

function checkPrivate(response) {
  assert.match(response.headers.get('X-Robots-Tag') ?? '', /noindex/);
  assert.match(response.headers.get('Cache-Control') ?? '', /no-store/);
  assert.match(response.headers.get('Cache-Control') ?? '', /private/);
  if (origin.protocol === 'https:') assert.match(response.headers.get('Strict-Transport-Security') ?? '', /max-age=/);
}

// A first deployment may need a short wait for DNS and the custom domain certificate.
let ready = false;
for (let attempt = 1; attempt <= 24; attempt++) {
  let response;
  try { response = await get('/'); } catch { /* DNS or TLS may still be provisioning. */ }
  if (response) {
    const status = response.status;
    await response.body?.cancel();
    assert(status !== 200, 'The site is accessible without authentication');
    if (status === 401) { ready = true; break; }
  }
  console.log(`Waiting for the protected custom domain (${attempt}/24)`);
  if (attempt < 24) await delay(5000);
}
assert(ready, 'The protected custom domain did not become available');

const builtFiles = readdirSync(new URL('../../recruit/dist/', import.meta.url), { recursive: true });
const assets = ['.css', '.webp', '.woff2'].map(extension => {
  const file = builtFiles.find(file => file.endsWith(extension));
  assert(file, `Missing build asset: ${extension}`);
  return `/${file}`;
});
const paths = [
  ['/', 200], ['/design/', 200], ['/privacy/', 200], ['/photo-brief/', 200],
  ['/robots.txt', 200], ['/sitemap.xml', 200], ['/missing-auth-check', 404],
  ['/api/health', 200], ['/api/events', 405],
  ...assets.map(path => [path, 200]),
];
for (const [path, expectedStatus] of paths) {
  const denied = await get(path);
  assert.equal(denied.status, 401, `Unauthenticated ${path}`);
  assert.match(denied.headers.get('WWW-Authenticate') ?? '', /^Basic /);
  checkPrivate(denied);
  await denied.body?.cancel();

  const allowed = await get(path, authorization);
  assert.equal(allowed.status, expectedStatus, `Authenticated ${path}`);
  checkPrivate(allowed);
  if (path === '/') {
    const html = await allowed.text();
    assert.match(html, /<meta\s+name="robots"\s+content="[^"]*noindex/);
  } else {
    await allowed.body?.cancel();
  }
  console.log(`Verified authentication and private headers: ${path}`);
}
const wrong = await get('/', `Basic ${Buffer.from('invalid-review:invalid-review-password').toString('base64')}`);
assert.equal(wrong.status, 401, 'Incorrect credentials must be rejected');
await wrong.body?.cancel();

if (!local) {
  const redirect = await fetch('http://recruit.okinawakaigo.com/design/?review=1', {
    redirect: 'manual', signal: AbortSignal.timeout(10000),
  });
  assert([301, 302, 307, 308].includes(redirect.status), 'HTTP must redirect to HTTPS');
  assert.equal(redirect.headers.get('Location'), 'https://recruit.okinawakaigo.com/design/?review=1');
  await redirect.body?.cancel();
}
console.log('Basic authentication, assets, API, noindex and private caching verified.');
