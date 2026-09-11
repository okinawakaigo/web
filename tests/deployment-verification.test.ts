import { describe, expect, it } from 'vitest';
import { assertDenied } from '../apps/api/scripts/verify-response.mjs';

const managed = '# Crawler policy\n\n# BEGIN Cloudflare Managed content\nUser-agent: *\nContent-Signal: search=yes,ai-train=no,use=reference\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\n# END Cloudflare Managed Content\n';
const response = (body = managed, status = 200, challenge = true) => new Response(body, {
  status,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', ...(challenge ? { 'WWW-Authenticate': 'Basic realm="Recruit preview"' } : {}) },
});

describe('公開後の認証検証', () => {
  it('401の認証要求を受け付ける', async () => {
    await expect(assertDenied(response('Authentication required', 401), '/')).resolves.toBeUndefined();
  });
  it('robots.txtだけCloudflareの自動生成文書を受け付ける', async () => {
    await expect(assertDenied(response(), '/robots.txt')).resolves.toBeUndefined();
  });
  it.each(['/', '/_astro/site.css', '/api/health'])('他のパスでは200を許可しない: %s', async path => {
    await expect(assertDenied(response(), path)).rejects.toThrow();
  });
  it.each([
    '<html>private site</html>',
    `${managed}<html>private site</html>`,
    `<html>private site</html>\n${managed}`,
    managed.replace('Allow: /', 'Allow: /private-content'),
  ])('サイト本文や未知の内容が混じったrobots.txtを拒否する', async body => {
    await expect(assertDenied(response(body), '/robots.txt')).rejects.toThrow();
  });
  it('元の認証要求ヘッダーが残っていない200応答を拒否する', async () => {
    await expect(assertDenied(response(managed, 200, false), '/robots.txt')).rejects.toThrow();
  });
});
