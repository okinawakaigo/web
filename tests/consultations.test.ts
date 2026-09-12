import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import recruit, { type Env } from '../apps/api/src/index';
import admin, { type DashboardEnv } from '../apps/api/src/dashboard-worker';
import localWorker from '../apps/api/src/local-worker';
import { notifyConsultation } from '../apps/api/src/mail';
import { parseConsultation } from '../packages/contracts/src/consultations';

const id = 'a74608c1-36aa-4c08-9a99-f9d0ca8e54e9';
const input = { id, name: '動作確認', email: 'test@example.invalid', role: 'その他', ageGroup: '', gender: '', availability: '平日午後', questions: '', source: 'instagram', medium: 'bio', consent: true };
const basic = (user: string, password: string) => `Basic ${btoa(`${user}:${password}`)}`;
const previewAuth = basic('recruit', 'test-preview-password');
const adminAuth = basic('admin', 'test-dashboard-password');
const mail = { RESEND_API_KEY: 'mock-key', NOTIFICATION_FROM: 'notice@example.invalid', NOTIFICATION_TO: 'staff@example.invalid', DASHBOARD_URL: 'https://dashboard.okinawakaigo.com/' };
let sql: DatabaseSync;
let env: Env;
let adminEnv: DashboardEnv;
let assetFetch: ReturnType<typeof vi.fn>;

// Run production migrations and queries against SQLite; mock only the D1 transport.
beforeEach(() => {
  sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../apps/api/migrations/0002_consultations.sql', import.meta.url), 'utf8'));
  const DB = { prepare(query: string) {
    const statement = sql.prepare(query);
    function bound(values: (string | number)[] = []) {
      return {
        bind: (...next: (string | number)[]) => bound(next),
        first: async () => statement.get(...values) ?? null,
        all: async () => ({ results: statement.all(...values), success: true }),
        run: async () => ({ success: true, meta: { changes: Number(statement.run(...values).changes) } }),
      };
    }
    return bound();
  } } as unknown as D1Database;
  assetFetch = vi.fn().mockImplementation(async () => new Response('asset'));
  env = { BASIC_AUTH_USERNAME: 'recruit', BASIC_AUTH_PASSWORD: 'test-preview-password', ASSETS: { fetch: assetFetch } as unknown as Fetcher, DB, CONSULTATION_ENABLED: 'true', LOCAL_FORM_TEST: 'true' };
  adminEnv = { DB, ASSETS: env.ASSETS, ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'test-dashboard-password' };
});
afterEach(() => { sql.close(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function request(path = '/api/consultations', body?: unknown, auth = previewAuth, origin = 'http://127.0.0.1:8787', method = body === undefined ? 'GET' : 'POST') {
  return new Request(origin + path, { method, headers: { Authorization: auth, Origin: origin, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function send(body: unknown = input) { return recruit.fetch(request('/api/consultations', body), env); }
async function manage(path = '/api/consultations', body?: unknown, method?: string) { return admin.fetch(request(path, body, adminAuth, 'http://127.0.0.1:8788', method), adminEnv); }
const count = () => (sql.prepare('SELECT COUNT(*) AS n FROM consultations').get() as { n: number }).n;

describe('ローカル専用プレビュー', () => {
  async function preview(incoming: Request, dashboard = false) {
    const url = new URL(incoming.url);
    if (dashboard) url.host = '127.0.0.1:8787';
    const forwarded = new Request(url, incoming);
    forwarded.headers.delete('Authorization');
    if (dashboard) {
      forwarded.headers.set('x-local-app', 'dashboard');
      forwarded.headers.set('x-local-origin', new URL(incoming.url).origin);
    }
    const pending: Promise<unknown>[] = [];
    const response = await localWorker.fetch(forwarded, {
      ASSETS: env.ASSETS, DB: env.DB, CONSULTATION_ENABLED: 'true', LOCAL_FORM_TEST: 'true',
    }, { waitUntil: (task: Promise<unknown>) => pending.push(task) } as unknown as ExecutionContext);
    await Promise.all(pending);
    return response;
  }

  it.each([false, true])('認証情報の設定なしで画面と静的ファイルを開ける（管理画面=%s）', async dashboard => {
    for (const path of ['/', '/assets/app.js']) {
      const response = await preview(new Request(`http://127.0.0.1:8788${path}`), dashboard);
      expect(response.status).toBe(200);
      expect(response.headers.has('WWW-Authenticate')).toBe(false);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
      const assetRequest = assetFetch.mock.lastCall![0] as Request;
      expect(new URL(assetRequest.url).pathname).toBe(`/${dashboard ? 'dashboard' : 'recruit'}${path}`);
    }
  });

  it('認証なしで相談を保存・閲覧・更新でき、別Originからの更新は拒否する', async () => {
    expect((await preview(request('/api/consultations', input))).status).toBe(201);
    const manageLocal = (path: string, body?: unknown, method?: string) => preview(request(path, body, '', 'http://127.0.0.1:8788', method), true);
    const listing = await (await manageLocal('/api/consultations')).json();
    expect(listing.items).toHaveLength(1);
    const path = `/api/consultations/${id}`;
    expect(await (await manageLocal(path)).json()).toMatchObject({ name: input.name });
    const update = { status: '連絡済み', note: 'ローカルで確認', revision: 0 };
    const crossOrigin = request(path, update, '', 'http://127.0.0.1:8788', 'PATCH');
    crossOrigin.headers.set('Origin', 'https://other.example');
    expect((await preview(crossOrigin, true)).status).toBe(403);
    expect((await manageLocal(path, update, 'PATCH')).status).toBe(200);
    expect(await (await manageLocal(path)).json()).toMatchObject({ ...update, revision: 1 });
  });

  it.each(['https://dashboard.okinawakaigo.com', 'http://192.168.1.10', 'http://localhost.example.com'])(
    'ローカル専用Workerは外部ホストと外部の転送先を拒否する: %s', async origin => {
      expect((await preview(new Request(`${origin}/api/consultations`))).status).toBe(403);
      expect((await preview(new Request(`${origin}/api/consultations`), true)).status).toBe(403);
      expect(assetFetch).not.toHaveBeenCalled();
    },
  );

  it('本番用Workerではローカル用ヘッダーを送っても認証を回避できない', async () => {
    const limiter = { limit: vi.fn().mockResolvedValue({ success: true }) } as unknown as RateLimit;
    for (const origin of ['http://127.0.0.1:8788', 'https://dashboard.okinawakaigo.com']) {
      for (const path of ['/', '/assets/app.js', '/api/consultations']) {
        const req = new Request(origin + path, { headers: { 'x-local-app': 'dashboard', 'x-local-origin': 'http://127.0.0.1:8788' } });
        expect((await recruit.fetch(req, env)).status).toBe(401);
        expect((await admin.fetch(req, { ...adminEnv, ADMIN_RATE_LIMITER: limiter })).status).toBe(401);
      }
    }
    expect(assetFetch).not.toHaveBeenCalled();
  });

  it('開発サーバーがURLを書き換えても外部のHostヘッダーを拒否する', async () => {
    const req = new Request('http://127.0.0.1:8787/', { headers: { Host: 'external.example.invalid' } });
    expect((await preview(req)).status).toBe(403);
    expect(assetFetch).not.toHaveBeenCalled();
  });
});

describe('参加相談の保存と入力検証', () => {
  it('同じ受付番号・内容を再送しても一件だけ保存し、異なる内容なら競合にする', async () => {
    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(201);
    expect(count()).toBe(1);
    expect((await send({ ...input, name: '変更した内容' })).status).toBe(409);
    const detail = await (await manage(`/api/consultations/${id}`)).json();
    expect(detail).toMatchObject({ name: input.name, status: '未対応', notification: 'unconfigured', source: 'instagram', medium: 'bio' });
    expect(detail).not.toHaveProperty('notification_payload');
  });
  it.each([
    { consent: false }, { email: 'not-an-email' }, { name: ' ' }, { name: 'a'.repeat(101) },
    { ageGroup: '99代' }, { gender: 'invalid' }, { role: '未定義' }, { id: 'invalid' }, { extra: 'data' },
    { questions: 'a'.repeat(2001) },
  ])('不正入力を保存しない: %j', async changes => {
    expect((await send({ ...input, ...changes })).status).toBe(400);
    expect(count()).toBe(0);
  });
  it('任意項目の未回答と「回答しない」を受け付ける', () => {
    expect(parseConsultation(input)).not.toBeNull();
    expect(parseConsultation({ ...input, ageGroup: '回答しない', gender: '回答しない' })).not.toBeNull();
  });
  it('自由な流入元を保存せず、既定の分類へ変換する', async () => {
    await send({ ...input, source: 'secret@example.invalid', medium: 'arbitrary' });
    expect(sql.prepare('SELECT source,medium FROM consultations').get()).toMatchObject({ source: 'direct', medium: 'none' });
  });
  it('Origin・形式・実際の本文サイズを検査する', async () => {
    const cross = request('/api/consultations', input); cross.headers.set('Origin', 'https://other.example');
    expect((await recruit.fetch(cross, env)).status).toBe(403);
    const plain = request('/api/consultations', input); plain.headers.set('Content-Type', 'text/plain');
    expect((await recruit.fetch(plain, env)).status).toBe(415);
    const oversized = request('/api/consultations', 'あ'.repeat(6000)); oversized.headers.delete('Content-Length');
    expect((await recruit.fetch(oversized, env)).status).toBe(413);
    expect(count()).toBe(0);
  });
  it('公開側は相談一覧・個別情報を返さない', async () => {
    await send();
    expect(await (await recruit.fetch(request(), env)).json()).toEqual({ ready: true, localTest: true });
    expect((await recruit.fetch(request(`/api/consultations/${id}`), env)).status).toBe(404);
  });
  it('ローカル用の検証省略を本番ホストでは認めない', async () => {
    const response = await recruit.fetch(request('/api/consultations', input, previewAuth, 'https://recruit.okinawakaigo.com'), env);
    expect(response.status).toBe(503); expect(count()).toBe(0);
  });
  it('Turnstileの成功・ホスト・用途とレート制限を検証する', async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    Object.assign(env, { TURNSTILE_SECRET_KEY: 'test', CONSULTATION_RATE_LIMITER: { limit } });
    const verify = vi.fn().mockResolvedValue(Response.json({ success: true, hostname: 'other.example', action: 'consultation' }));
    vi.stubGlobal('fetch', verify);
    const post = () => recruit.fetch(request('/api/consultations', { ...input, turnstileToken: 'token' }, previewAuth, 'https://recruit.okinawakaigo.com'), env);
    expect((await post()).status).toBe(400); expect(count()).toBe(0);
    verify.mockResolvedValue(Response.json({ success: true, hostname: 'recruit.okinawakaigo.com', action: 'wrong' }));
    expect((await post()).status).toBe(400);
    limit.mockResolvedValue({ success: false }); expect((await post()).status).toBe(429);
    limit.mockResolvedValue({ success: true });
    verify.mockResolvedValue(Response.json({ success: true, hostname: 'recruit.okinawakaigo.com', action: 'consultation' }));
    expect((await post()).status).toBe(201); expect(count()).toBe(1);
  });
});

describe('管理者専用API', () => {
  it('公開サイトの認証では管理画面・APIに入れず、管理認証未設定時も閉じる', async () => {
    for (const path of ['/', '/api/consultations', `/api/consultations/${id}`]) {
      const denied = await admin.fetch(request(path, undefined, previewAuth), adminEnv);
      expect(denied.status).toBe(401);
      expect(denied.headers.get('Cache-Control')).toContain('no-store');
      expect(denied.headers.get('X-Robots-Tag')).toContain('noindex');
    }
    expect((await admin.fetch(request('/', undefined, adminAuth), { ...adminEnv, ADMIN_PASSWORD: undefined })).status).toBe(503);
    expect((await admin.fetch(request('/', undefined, adminAuth, 'https://dashboard.okinawakaigo.com'), adminEnv)).status).toBe(503);
    expect(assetFetch).not.toHaveBeenCalled();
  });
  it('管理用静的配信にはAuthorizationを引き継がない', async () => {
    expect((await manage('/')).status).toBe(200);
    expect(assetFetch.mock.calls[0][0].headers.has('Authorization')).toBe(false);
  });
  it('一覧には連絡先を含めず、更新競合でメモを上書きしない', async () => {
    await send();
    const listing = await (await manage()).json();
    expect(listing.items).toHaveLength(1); expect(listing.items[0]).not.toHaveProperty('email');
    expect(listing.hasMore).toBe(false);
    const update = { status: '連絡済み', note: '<script>この文字列もメモとして保存</script>', revision: 0 };
    expect((await manage(`/api/consultations/${id}`, update, 'PATCH')).status).toBe(200);
    expect((await manage(`/api/consultations/${id}`, { ...update, note: '古い画面から' }, 'PATCH')).status).toBe(409);
    expect(await (await manage(`/api/consultations/${id}`)).json()).toMatchObject({ note: update.note, revision: 1, status: '連絡済み' });
    expect((await (await manage('/api/consultations?status=' + encodeURIComponent('未対応'))).json()).items).toHaveLength(0);
  });
  it('管理操作でも別Originを拒否する', async () => {
    await send();
    const req = request(`/api/consultations/${id}/notify`, {}, adminAuth); req.headers.set('Origin', 'https://other.example');
    expect((await admin.fetch(req, adminEnv)).status).toBe(403);
  });
  it('全期間の状態別件数と検索結果の件数を分け、ページをまたいで検索する', async () => {
    const insert = sql.prepare('INSERT INTO consultations(id,created_at,name,email,role,age_group,gender,availability,questions,source,medium,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
    for (let i = 0; i < 53; i++) insert.run(crypto.randomUUID(), new Date(2026, 0, i + 1).toISOString(), i === 0 ? '古い相談の沖縄さん' : `相談者${i}`, 'test@example.invalid', 'その他', '', '', '', '', 'direct', 'none', i % 2 ? '連絡済み' : '未対応');
    const first = await (await manage()).json();
    expect(first).toMatchObject({ total: 53, hasMore: true, counts: { 未対応: 27, 連絡済み: 26, 日程確定: 0, 対応完了: 0 } });
    expect(first.items).toHaveLength(50);
    expect((await (await manage('/api/consultations?offset=50')).json()).items).toHaveLength(3);
    const search = await (await manage('/api/consultations?q=' + encodeURIComponent('沖縄'))).json();
    expect(search.total).toBe(1); expect(search.items[0].name).toBe('古い相談の沖縄さん');
    expect(search.counts).toEqual(first.counts);
    expect((await (await manage('/api/consultations?status=' + encodeURIComponent('連絡済み') + '&q=' + encodeURIComponent('沖縄'))).json()).total).toBe(0);
  });
  it('検索中のワイルドカードやSQL構文を文字として扱い、長すぎる検索語を拒否する', async () => {
    await send({ ...input, name: '100%_確認' });
    await send({ ...input, id: crypto.randomUUID(), name: '通常の確認' });
    for (const query of ['%', '_', '100%_']) expect((await (await manage('/api/consultations?q=' + encodeURIComponent(query))).json()).total).toBe(1);
    expect((await (await manage('/api/consultations?q=' + encodeURIComponent("' OR 1=1 --"))).json()).total).toBe(0);
    expect((await manage('/api/consultations?q=' + 'a'.repeat(101))).status).toBe(400);
  });
});

describe('Resend通知', () => {
  it('失敗しても保存を維持し、同じキー・同じ内容で再試行する', async () => {
    const fetchMail = vi.fn().mockResolvedValue(Response.json({ message: 'unavailable' }, { status: 503 }));
    vi.stubGlobal('fetch', fetchMail); Object.assign(env, mail);
    expect((await send()).status).toBe(201); expect(count()).toBe(1);
    expect(sql.prepare('SELECT notification FROM consultations').get()).toMatchObject({ notification: 'failed' });
    const first = fetchMail.mock.calls[0][1];
    expect(first.headers['Idempotency-Key']).toBe(`consultation/${id}`);
    expect(first.body).not.toContain(input.name); expect(first.body).not.toContain(input.email);
    expect(first.body).toContain(`https://dashboard.okinawakaigo.com/#${id}`);
    fetchMail.mockResolvedValue(Response.json({ id: 'mail-id' }));
    await notifyConsultation(env.DB!, { ...mail, NOTIFICATION_TO: 'changed@example.invalid' }, id);
    expect(fetchMail.mock.calls[1][1].body).toBe(first.body);
    expect(sql.prepare('SELECT notification,notification_id FROM consultations').get()).toMatchObject({ notification: 'sent', notification_id: 'mail-id' });
    await notifyConsultation(env.DB!, mail, id); expect(fetchMail).toHaveBeenCalledTimes(2);
  });
  it('重複防止期間を越えた通知は再送しない', async () => {
    await send();
    sql.prepare("UPDATE consultations SET notification_started_at = ?, notification_payload = '{}' WHERE id = ?").run(new Date(Date.now() - 24 * 3600000).toISOString(), id);
    const fetchMail = vi.fn(); vi.stubGlobal('fetch', fetchMail);
    await notifyConsultation(env.DB!, mail, id);
    expect(fetchMail).not.toHaveBeenCalled();
    expect(sql.prepare('SELECT notification FROM consultations').get()).toMatchObject({ notification: 'failed' });
  });
});
