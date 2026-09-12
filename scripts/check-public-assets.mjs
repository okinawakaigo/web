import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

for (const app of ['recruit', 'dashboard']) {
  const dist = new URL(`../apps/${app}/dist/`, import.meta.url);
  assert(existsSync(new URL('index.html', dist)), `${app} build is missing`);
  for (const path of ['design', 'design.html', 'guidelines', 'guidelines.html']) {
    assert(!existsSync(new URL(path, dist)), `Local design guide must not be shipped in ${app}`);
  }
}
for (const [file, directory] of [['wrangler.jsonc', '../recruit/dist'], ['wrangler.dashboard.jsonc', '../dashboard/dist']]) {
  const config = JSON.parse(readFileSync(new URL(`../apps/api/${file}`, import.meta.url), 'utf8'));
  assert.equal(config.assets.directory, directory, 'Deploy only the intended app assets');
}
// The Worker CSP has no 'unsafe-inline' for scripts, so a build that inlines one would ship a page that cannot run.
for (const app of ['recruit', 'dashboard']) {
  const dist = new URL(`../apps/${app}/dist/`, import.meta.url);
  for (const file of readdirSync(dist, { recursive: true }).filter(name => name.endsWith('.html'))) {
    const html = readFileSync(new URL(file, dist), 'utf8');
    const inline = (html.match(/<script\b(?![^>]*\bsrc=)[^>]*>/gi) ?? []).filter(tag => !/\btype=["']application\/ld\+json["']/i.test(tag));
    assert.equal(inline.length, 0, `${app}/${file} has an inline script; the CSP does not allow it`);
    assert.doesNotMatch(html, /<[a-z][^>]*\son[a-z]+\s*=/i, `${app}/${file} has an inline event handler; the CSP does not allow it`);
  }
}
console.log('Public assets exclude the local design guide and inline scripts.');
