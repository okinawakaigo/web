import { describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../apps/api/src/index';

const origin = 'https://recruit.okinawakaigo.com';
const credentials = { BASIC_AUTH_USERNAME: 'review', BASIC_AUTH_PASSWORD: 'test-only-password:123' };
const authorization = (user = credentials.BASIC_AUTH_USERNAME, password = credentials.BASIC_AUTH_PASSWORD) =>
  `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

function bindings() {
  const fetch = vi.fn().mockImplementation(async () => new Response('private asset', {
    headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=31536000, immutable' },
  }));
  const prepare = vi.fn();
  return { fetch, prepare, env: { ...credentials, ASSETS: { fetch }, METRICS: { prepare } } as unknown as Env };
}

function expectPrivate(response: Response) {
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive');
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(response.headers.get('X-Frame-Options')).toBe('DENY');
}

describe('Basic認証', () => {
  it.each(['/', '/design/', '/privacy/', '/photo-brief/', '/_astro/site.css', '/images/care.webp', '/robots.txt', '/sitemap-index.xml', '/missing', '/api/health', '/api/events'])(
    '未認証ではページ・画像・APIを配信しない: %s', async path => {
      const { env, fetch, prepare } = bindings();
      const response = await worker.fetch(new Request(`${origin}${path}`), env);
      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toBe('Basic realm="Recruit preview", charset="UTF-8"');
      expect(await response.text()).not.toContain('private asset');
      expect(fetch).not.toHaveBeenCalled();
      expect(prepare).not.toHaveBeenCalled();
      expectPrivate(response);
    },
  );

  it.each([
    ['wrong ID', authorization('other')],
    ['wrong password', authorization('review', 'incorrect-password')],
    ['empty password', authorization('review', '')],
    ['unsupported scheme', 'Bearer token'],
    ['invalid base64', 'Basic %%%%'],
    ['missing separator', `Basic ${btoa('review')}`],
    ['missing token', 'Basic'],
    ['multiple credentials', `${authorization()}, ${authorization()}`],
    ['oversized token', `Basic ${'a'.repeat(3000)}`],
  ])('不正な認証情報を拒否する: %s', async (_, value) => {
    const { env, fetch } = bindings();
    const response = await worker.fetch(new Request(origin, { headers: { Authorization: value } }), env);
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expectPrivate(response);
  });

  it.each(['POST', 'HEAD', 'OPTIONS'])('GET以外も認証前に処理しない: %s', async method => {
    const { env, fetch, prepare } = bindings();
    const response = await worker.fetch(new Request(`${origin}/api/events`, { method }), env);
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });

  it.each([
    { BASIC_AUTH_USERNAME: undefined },
    { BASIC_AUTH_PASSWORD: undefined },
    { BASIC_AUTH_USERNAME: '' },
    { BASIC_AUTH_USERNAME: 'user:password' },
    { BASIC_AUTH_PASSWORD: '' },
    { BASIC_AUTH_PASSWORD: 'short' },
    { BASIC_AUTH_PASSWORD: 'password-with-newline\n' },
  ])('認証設定が不完全ならサイトを閉じる: %j', async missing => {
    const { env, fetch } = bindings();
    const response = await worker.fetch(new Request(origin, { headers: { Authorization: authorization() } }), { ...env, ...missing });
    expect(response.status).toBe(503);
    expect(response.headers.has('WWW-Authenticate')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expectPrivate(response);
  });

  it('正しい認証後に配信し、認証ヘッダーは静的配信に引き継がない', async () => {
    const { env, fetch } = bindings();
    const response = await worker.fetch(new Request(origin, { headers: { Authorization: authorization() } }), env);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('private asset');
    expect(fetch).toHaveBeenCalledOnce();
    expect((fetch.mock.calls[0][0] as Request).headers.has('Authorization')).toBe(false);
    expect(response.headers.get('Content-Type')).toBe('text/html');
    expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000');
    expectPrivate(response);
  });

  it('UTF-8とコロンを含むパスワード、大小文字の異なるBasicスキームを扱う', async () => {
    const { env } = bindings();
    const password = '確認用パスワード:1234567890';
    const response = await worker.fetch(new Request(origin, {
      headers: { Authorization: authorization('review', password).replace('Basic', 'bAsIc') },
    }), { ...env, BASIC_AUTH_PASSWORD: password });
    expect(response.status).toBe(200);
  });

  it('公開HTTPは認証を求める前に同じパス・クエリーのHTTPSへ転送する', async () => {
    const { env, fetch } = bindings();
    const response = await worker.fetch(new Request('http://recruit.okinawakaigo.com/design/?review=1'), env);
    expect(response.status).toBe(308);
    expect(response.headers.get('Location')).toBe(`${origin}/design/?review=1`);
    expect(response.headers.has('WWW-Authenticate')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expectPrivate(response);
  });

  it('ローカルHTTPでも認証は必須', async () => {
    const { env } = bindings();
    expect((await worker.fetch(new Request('http://127.0.0.1:8787/'), env)).status).toBe(401);
    expect((await worker.fetch(new Request('http://127.0.0.1:8787/', { headers: { Authorization: authorization() } }), env)).status).toBe(200);
  });

  it('認証済みのAPI・エラー・304もキャッシュと検索登録を許可しない', async () => {
    const { env, fetch } = bindings();
    for (const [path, status] of [['/api/health', 200], ['/api/missing', 404], ['/api/events', 405]] as const) {
      const response = await worker.fetch(new Request(`${origin}${path}`, { headers: { Authorization: authorization() } }), env);
      expect(response.status).toBe(status);
      expectPrivate(response);
    }
    fetch.mockResolvedValue(new Response(null, { status: 304 }));
    const response = await worker.fetch(new Request(origin, { headers: { Authorization: authorization() } }), env);
    expect(response.status).toBe(304);
    expectPrivate(response);
  });
});
