import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import dashboard, { type DashboardEnv } from '../apps/api/src/dashboard-worker';
import recruit, { type Env } from '../apps/api/src/index';
import { defaultReplySubject, parseReply } from '../packages/contracts/src/replies';

const consultationId = 'a74608c1-36aa-4c08-9a99-f9d0ca8e54e9';
const replyId = '693a7a0e-a66f-4162-89c4-c0b8aeea67b2';
const base = `/api/consultations/${consultationId}/replies`;
const draft = { id: replyId, subject: defaultReplySubject, body: '参加相談ありがとうございます。\nご希望の日時をお知らせください。' };
const live = { REPLY_ENABLED: 'true', RESEND_API_KEY: 'mock-key', REPLY_FROM: '沖縄介護センター <staff@example.invalid>', REPLY_TO: 'inbox@example.invalid' };
let sql: DatabaseSync;
let env: DashboardEnv;
let provider: ReturnType<typeof vi.fn>;
beforeEach(() => {
  sql = new DatabaseSync(':memory:');
  for (const name of ['0002_consultations', '0003_consultation_replies']) sql.exec(readFileSync(new URL(`../apps/api/migrations/${name}.sql`, import.meta.url), 'utf8'));
  const DB = { prepare(query: string) {
    const statement = sql.prepare(query);
    function bound(values: (string | number | null)[] = []) {
      return { bind: (...next: (string | number | null)[]) => bound(next), first: async () => statement.get(...values) ?? null,
        all: async () => ({ results: statement.all(...values), success: true }),
        run: async () => ({ success: true, meta: { changes: Number(statement.run(...values).changes) } }) };
    }
    return bound();
  } } as unknown as D1Database;
  sql.prepare('INSERT INTO consultations(id,created_at,name,email,role,source,medium) VALUES (?,?,?,?,?,?,?)')
    .run(consultationId, new Date().toISOString(), '確認用', 'applicant@example.invalid', 'その他', 'direct', 'none');
  env = { DB, ASSETS: { fetch: vi.fn() } as unknown as Fetcher, ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'test-dashboard-password',
    ADMIN_RATE_LIMITER: { limit: async () => ({ success: true }) } as RateLimit, ...live };
  provider = vi.fn().mockImplementation(async () => Response.json({ id: 'provider-id' })); vi.stubGlobal('fetch', provider);
});
afterEach(() => { sql.close(); vi.unstubAllGlobals(); });
function request(path = base, body?: unknown, origin = 'https://dashboard.okinawakaigo.com') {
  return new Request(origin + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Basic ${btoa('admin:test-dashboard-password')}`, Origin: origin, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const send = (body: unknown = draft) => dashboard.fetch(request(base, body), env);
const list = async () => (await dashboard.fetch(request(), env)).json();

describe('ダッシュボードからのメール返信', () => {
  it('本文を先に保存し、宛先・差出人・返信先をサーバーで決めてResendに送る', async () => {
    provider.mockImplementation(async () => {
      expect(sql.prepare('SELECT status,body FROM consultation_replies').get()).toMatchObject({ status: 'pending', body: draft.body });
      return Response.json({ id: 'provider-id' });
    });
    const response = await send(); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'accepted', canRetry: false, to: 'applicant@example.invalid', sentBy: 'admin' });
    const [url, init] = provider.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers['Idempotency-Key']).toBe(`consultation-reply/${replyId}`);
    expect(JSON.parse(init.body)).toEqual({ from: live.REPLY_FROM, to: ['applicant@example.invalid'], reply_to: live.REPLY_TO, subject: draft.subject, text: draft.body });
    const history = await list(); expect(history.items).toHaveLength(1);
    for (const secret of ['payload', 'provider_id', 'mode', 'consultationId']) expect(history.items[0]).not.toHaveProperty(secret);
    expect(JSON.stringify(history)).not.toContain(live.RESEND_API_KEY);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
  it('同じIDの二重クリック・再読み込み・再試行で送信を増やさない', async () => {
    await send(); await send();
    await dashboard.fetch(request(`${base}/${replyId}/retry`, {}), env);
    expect(provider).toHaveBeenCalledOnce(); expect((await list()).items).toHaveLength(1);
    expect((await send({ ...draft, body: '変更した内容' })).status).toBe(409);
  });
  it('タイムアウトでも本文を残し、設定変更後も同じ宛先・本文・キーで再試行する', async () => {
    provider.mockRejectedValueOnce(new Error('timeout'));
    expect(await (await send()).json()).toMatchObject({ status: 'uncertain', canRetry: true });
    const initial = provider.mock.calls[0][1]; env.REPLY_FROM = 'changed@example.invalid'; env.REPLY_TO = 'changed-inbox@example.invalid';
    const result = await dashboard.fetch(request(`${base}/${replyId}/retry`, {}), env);
    expect(await result.json()).toMatchObject({ status: 'accepted', from: live.REPLY_FROM, replyTo: live.REPLY_TO });
    expect(provider.mock.calls[1][1].body).toBe(initial.body);
    expect(provider.mock.calls[1][1].headers['Idempotency-Key']).toBe(initial.headers['Idempotency-Key']);
  });
  it('並行した失敗が送信受付済みの結果を上書きしない', async () => {
    let rejectFirst!: (reason: Error) => void;
    provider.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }));
    const first = send();
    await vi.waitFor(() => expect(provider).toHaveBeenCalledOnce());
    expect(await (await send()).json()).toMatchObject({ status: 'accepted' });
    rejectFirst(new Error('timeout'));
    expect(await (await first).json()).toMatchObject({ status: 'accepted' });
    expect(provider.mock.calls[0][1].body).toBe(provider.mock.calls[1][1].body);
  });
  it('23時間を超えた不明な送信は再送しない', async () => {
    provider.mockRejectedValueOnce(new Error('timeout')); await send();
    sql.prepare('UPDATE consultation_replies SET created_at = ?').run(new Date(Date.now() - 23 * 3600000 - 1000).toISOString());
    expect((await list()).items[0].canRetry).toBe(false);
    expect((await send()).status).toBe(409);
    expect((await dashboard.fetch(request(`${base}/${replyId}/retry`, {}), env)).status).toBe(409);
    expect(provider).toHaveBeenCalledOnce();
  });
  it('ローカル検証はキーがあっても送信せず、本番ホストでは検証モードを許可しない', async () => {
    env.LOCAL_MAIL_TEST = 'true'; env.REPLY_ENABLED = 'false';
    const response = await dashboard.fetch(request(base, draft, 'http://127.0.0.1:8788'), env);
    expect(await response.json()).toMatchObject({ status: 'test', canRetry: false });
    expect(provider).not.toHaveBeenCalled();
    env.REPLY_ENABLED = 'true';
    await dashboard.fetch(request(`${base}/${replyId}/retry`, {}), env);
    expect(provider).not.toHaveBeenCalled();
    env.REPLY_ENABLED = 'false';
    expect((await send({ ...draft, id: crypto.randomUUID() })).status).toBe(503);
    expect((await list()).settings).toMatchObject({ localTest: false, available: false });
  });
  it('未設定・不正な設定では送信を開始しない', async () => {
    for (const change of [{ RESEND_API_KEY: '' }, { REPLY_FROM: 'x@example.invalid\r\nBcc: x@example.invalid' }, { REPLY_TO: '' }, { REPLY_TO: 'a@example.invalid,b@example.invalid' }]) {
      Object.assign(env, live, change); expect((await send()).status).toBe(503);
    }
    expect(provider).not.toHaveBeenCalled(); expect((await list()).items).toHaveLength(0);
  });
  it.each([{ to: 'other@example.invalid' }, { subject: '件名\r\nBcc: other@example.invalid' }, { body: '' }, { body: 'a'.repeat(6001) }, { id: '../secret' }])('不正な本文・宛先指定を拒否する: %j', async change => {
    expect((await send({ ...draft, ...change })).status).toBe(400); expect(provider).not.toHaveBeenCalled();
  });
  it('日本語6000文字を受け付け、過大なリクエストは保存前に拒否する', async () => {
    expect(parseReply({ ...draft, body: 'あ'.repeat(6000) })).not.toBeNull();
    expect((await send({ ...draft, body: 'あ'.repeat(6000) })).status).toBe(200);
    expect((await send({ ...draft, body: 'あ'.repeat(12000) })).status).toBe(413);
  });
  it('認証・同一Originが必須で、公開サイトから履歴を取得できない', async () => {
    const anonymous = request(base, draft); anonymous.headers.delete('Authorization');
    expect((await dashboard.fetch(anonymous, env)).status).toBe(401);
    const cross = request(base, draft); cross.headers.set('Origin', 'https://other.example');
    expect((await dashboard.fetch(cross, env)).status).toBe(403);
    const publicEnv = { ...env, BASIC_AUTH_USERNAME: 'admin', BASIC_AUTH_PASSWORD: 'test-dashboard-password' } as Env;
    expect((await recruit.fetch(request(), publicEnv)).status).toBe(404);
    expect(provider).not.toHaveBeenCalled();
  });
  it('相談間で履歴・再試行・IDを混同せず、50件ずつ取得する', async () => {
    env.LOCAL_MAIL_TEST = 'true';
    for (let i = 0; i < 52; i++) await dashboard.fetch(request(base, { ...draft, id: crypto.randomUUID(), body: `返信${i}` }, 'http://127.0.0.1:8788'), env);
    const first = await list(); expect(first.items).toHaveLength(50); expect(first.nextCursor).toBeTruthy();
    const second = await (await dashboard.fetch(request(`${base}?before=${first.nextCursor}`), env)).json();
    expect(second.items).toHaveLength(2); expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map(row => row.id)).size).toBe(52);
    const otherId = crypto.randomUUID();
    sql.prepare('INSERT INTO consultations(id,created_at,name,email,role,source,medium) VALUES (?,?,?,?,?,?,?)').run(otherId, new Date().toISOString(), '別の相談', 'other@example.invalid', 'その他', 'direct', 'none');
    const other = `/api/consultations/${otherId}/replies`;
    expect((await dashboard.fetch(request(`${other}/${first.items[0].id}/retry`, {}), env)).status).toBe(404);
    expect((await dashboard.fetch(request(`${other}?before=${first.nextCursor}`), env)).status).toBe(400);
    expect((await dashboard.fetch(request(other, { ...draft, id: first.items[0].id }, 'http://127.0.0.1:8788'), env)).status).toBe(409);
  });
});
