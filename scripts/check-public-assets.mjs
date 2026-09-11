import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

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
console.log('Public assets exclude the local design guide.');
