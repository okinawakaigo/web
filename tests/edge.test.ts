import { describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../apps/api/src/index';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { sqliteD1 } from './sqlite-d1';

const credentials = { BASIC_AUTH_USERNAME: 'review', BASIC_AUTH_PASSWORD: 'test-only-password:123' };
const authorization = `Basic ${btoa(`${credentials.BASIC_AUTH_USERNAME}:${credentials.BASIC_AUTH_PASSWORD}`)}`;
const authorized = (url: string) => new Request(url, { headers: { Authorization: authorization } });

function bindings() {
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn().mockReturnValue({ run });
  const prepare = vi.fn().mockReturnValue({ bind });
  const limit = vi.fn().mockResolvedValue({ success: true });
  const fetch = vi.fn().mockResolvedValue(new Response('asset'));
  return { env: { ...credentials, ASSETS: { fetch }, METRICS: { prepare }, METRICS_RATE_LIMITER: { limit } } as unknown as Env, run, bind, prepare, limit, fetch };
}
function request(body: unknown = { source: 'instagram', medium: 'bio', event: 'page_view' }, options: { origin?: string; contentType?: string; method?: string } = {}) {
  const method = options.method ?? 'POST';
  return new Request('https://okinawakaigo.com/api/events', {
    method, headers: { Authorization: authorization, Origin: options.origin ?? 'https://okinawakaigo.com', 'Content-Type': options.contentType ?? 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}

describe('計測API', () => {
  it('JSTの日付と件数だけをアトミックに集計する', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-05T15:01:00Z'));
    const sql = new DatabaseSync(':memory:');
    sql.exec(readFileSync(new URL('../apps/api/migrations/0001_metrics.sql', import.meta.url), 'utf8'));
    try {
      const { env } = bindings();
      env.METRICS = sqliteD1(sql);
      expect((await worker.fetch(request(), env)).status).toBe(204);
      expect((await worker.fetch(request(), env)).status).toBe(204);
      expect(sql.prepare('SELECT * FROM daily_events').all()).toEqual([
        { day: '2026-09-06', source: 'instagram', medium: 'bio', event: 'page_view', count: 2 },
      ]);
    } finally { sql.close(); vi.useRealTimers(); }
  });
  it.each([
    { source: 'instagram', medium: 'bio', event: 'page_view', email: 'private@example.com' },
    { source: 'private@example.com', medium: 'none', event: 'page_view' },
    { source: 'direct', medium: 'bio', event: 'page_view' },
    { source: 'direct', medium: 'none', event: 'reservation_complete' }, null, [], 'invalid',
  ])('未定義のデータや個人情報をDBに渡さない: %j', async body => {
    const { env, prepare } = bindings();
    expect((await worker.fetch(request(body), env)).status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });
  it('別オリジンからのリクエストを拒否する', async () => {
    const { env, prepare } = bindings();
    expect((await worker.fetch(request(undefined, { origin: 'https://example.com' }), env)).status).toBe(403);
    expect(prepare).not.toHaveBeenCalled();
  });
  it('POSTとJSONだけを許可する', async () => {
    const { env } = bindings();
    expect((await worker.fetch(request(undefined, { method: 'GET' }), env)).status).toBe(405);
    expect((await worker.fetch(request(undefined, { contentType: 'text/plain' }), env)).status).toBe(415);
  });
  it('Content-Lengthのない大きなボディも拒否する', async () => {
    const { env, prepare } = bindings();
    expect((await worker.fetch(request('x'.repeat(600)), env)).status).toBe(413);
    expect(prepare).not.toHaveBeenCalled();
  });
  it('壊れたJSONを拒否する', async () => {
    const { env } = bindings();
    const broken = new Request(request(), { body: '{' });
    expect((await worker.fetch(broken, env)).status).toBe(400);
  });
  it('制限に達したら書き込まない', async () => {
    const { env, limit, prepare } = bindings(); limit.mockResolvedValue({ success: false });
    expect((await worker.fetch(request(), env)).status).toBe(429);
    expect(prepare).not.toHaveBeenCalled();
  });
  it('D1未設定時や障害時は計測成功にしない', async () => {
    const { env, run } = bindings();
    expect((await worker.fetch(request(), { ...credentials, ASSETS: env.ASSETS })).status).toBe(503);
    run.mockRejectedValue(new Error('database unavailable'));
    expect((await worker.fetch(request(), env)).status).toBe(503);
  });
  it('公開の読み出しAPIを設けず、静的ページは配信する', async () => {
    const { env, fetch } = bindings();
    expect((await worker.fetch(authorized('https://okinawakaigo.com/api/report'), env)).status).toBe(404);
    expect(await (await worker.fetch(authorized('https://okinawakaigo.com/'), env)).text()).toBe('asset');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
