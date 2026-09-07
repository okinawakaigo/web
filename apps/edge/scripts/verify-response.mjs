import assert from 'node:assert/strict';

export async function assertDenied(response, path) {
  assert.match(response.headers.get('WWW-Authenticate') ?? '', /^Basic /);
  if (path === '/robots.txt' && response.status === 200) {
    // Cloudflare can replace the origin's 401 with managed crawler directives.
    // Accept only that generated document, with no appended origin content.
    assert.match(response.headers.get('Content-Type') ?? '', /^text\/plain\b/);
    const body = (await response.text()).replace(/\r\n/g, '\n');
    const managed = body.match(/^([\s\S]*?)# BEGIN Cloudflare Managed content\n([\s\S]*?)# END Cloudflare Managed Content\s*$/i);
    assert(managed, 'Expected only Cloudflare-managed robots.txt');
    assert(managed[1].split('\n').every(line => !line.trim() || line.startsWith('#')), 'Unexpected content before managed robots.txt');
    assert(managed[2].split('\n').every(line => !line.trim()
      || /^(?:User-agent: [\w.*-]+|Content-signal: [\w=, -]+|(?:Allow|Disallow): \/)$/i.test(line)), 'Unexpected content in managed robots.txt');
    return;
  }
  assert.equal(response.status, 401, `Unauthenticated ${path}`);
  await response.body?.cancel();
}
