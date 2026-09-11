import { isId, parseConsultation, statuses, type Consultation, type ConsultationInput, type ConsultationList, type ConsultationSummary, type Status } from '@okinawa-care/contracts';
import { readAttribution } from '@okinawa-care/content/attribution';
import { HttpError, jsonBody, loopback } from './http';
import { notifyConsultation, type MailEnv } from './mail';

export interface ConsultationEnv extends MailEnv {
  DB?: D1Database;
  CONSULTATION_ENABLED?: string;
  TURNSTILE_SECRET_KEY?: string;
  CONSULTATION_RATE_LIMITER?: RateLimit;
  LOCAL_FORM_TEST?: string;
}
export const selectColumns = `id, created_at AS createdAt, name, email, role, age_group AS ageGroup,
  gender, availability, questions, source, medium, status, note, revision, notification`;
export function ready(env: ConsultationEnv, url: URL): boolean {
  return env.CONSULTATION_ENABLED === 'true' && !!env.DB
    && ((loopback(url) && env.LOCAL_FORM_TEST === 'true') || (!!env.TURNSTILE_SECRET_KEY && !!env.CONSULTATION_RATE_LIMITER));
}
export async function receiveConsultation(request: Request, env: ConsultationEnv, ctx?: Pick<ExecutionContext, 'waitUntil'>): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const available = ready(env, url);
    if (available) await env.DB!.prepare('SELECT id FROM consultations LIMIT 1').all();
    return Response.json({ ready: available, localTest: loopback(url) && env.LOCAL_FORM_TEST === 'true' });
  }
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
  if (!ready(env, url)) throw new HttpError(503, 'ただいま受付準備中です。');
  const body = await jsonBody(request);
  const input = parseConsultation(body);
  if (!input) throw new HttpError(400, '必須項目・メールアドレス・選択内容を確認してください。');
  if (env.CONSULTATION_RATE_LIMITER && !(await env.CONSULTATION_RATE_LIMITER.limit({ key: 'consultations' })).success) {
    throw new HttpError(429, 'ただいま混み合っています。少し時間をおいてお試しください。');
  }
  if (!(loopback(url) && env.LOCAL_FORM_TEST === 'true')) {
    const token = (body as Record<string, unknown>).turnstileToken;
    if (typeof token !== 'string' || !token || token.length > 2048) throw new HttpError(400, '送信前の確認が完了していません。もう一度お試しください。');
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY!, response: token }), signal: AbortSignal.timeout(10000),
    });
    const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
    if (!response.ok || !result.success || result.hostname !== url.hostname || result.action !== 'consultation') {
      throw new HttpError(400, '送信前の確認に失敗しました。もう一度お試しください。');
    }
  }
  const attribution = readAttribution(new URLSearchParams({ utm_source: input.source, utm_medium: input.medium }));
  Object.assign(input, attribution);
  const db = env.DB!;
  const createdAt = new Date().toISOString();
  await db.prepare(`INSERT INTO consultations(id,created_at,name,email,role,age_group,gender,availability,questions,source,medium)
    VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
    .bind(input.id, createdAt, input.name, input.email, input.role, input.ageGroup, input.gender, input.availability, input.questions, input.source, input.medium).run();
  const stored = await db.prepare(`SELECT ${selectColumns} FROM consultations WHERE id = ?`).bind(input.id).first<Consultation>();
  if (!stored) throw new Error('Insert not confirmed');
  const comparable: (keyof Omit<ConsultationInput, 'consent'>)[] = ['name', 'email', 'role', 'ageGroup', 'gender', 'availability', 'questions', 'source', 'medium'];
  if (comparable.some(key => stored[key] !== input[key])) throw new HttpError(409, '前回の送信内容と異なります。受付状況をご確認のうえ、画面を再読み込みしてください。');
  const notification = notifyConsultation(db, env, input.id).catch(() => { /* The saved consultation remains available to admins. */ });
  if (ctx) ctx.waitUntil(notification); else await notification;
  return Response.json({ id: stored.id, message: '説明会への参加相談を受け付けました。' }, { status: 201 });
}

export async function adminConsultations(request: Request, env: ConsultationEnv): Promise<Response> {
  const db = env.DB;
  if (!db) throw new HttpError(503, 'データベースが未設定です。');
  const url = new URL(request.url);
  if (url.pathname === '/api/consultations' && request.method === 'GET') {
    const status = url.searchParams.get('status') ?? '';
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const query = (url.searchParams.get('q') ?? '').trim();
    if ((status && !(statuses as readonly string[]).includes(status)) || !Number.isSafeInteger(offset) || offset < 0 || offset > 1000000 || query.length > 100) throw new HttpError(400, '検索条件を確認してください。');
    const conditions: string[] = [];
    const values: string[] = [];
    if (status) { conditions.push('status = ?'); values.push(status); }
    if (query) {
      conditions.push("(name LIKE ? ESCAPE '\\' OR role LIKE ? ESCAPE '\\')");
      const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
      values.push(pattern, pattern);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [result, total, grouped] = await Promise.all([
      db.prepare(`SELECT id,created_at AS createdAt,name,role,status,notification FROM consultations ${where} ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET ?`).bind(...values, offset).all<ConsultationSummary>(),
      db.prepare(`SELECT COUNT(*) AS count FROM consultations ${where}`).bind(...values).first<{ count: number }>(),
      db.prepare('SELECT status,COUNT(*) AS count FROM consultations GROUP BY status').all<{ status: Status; count: number }>(),
    ]);
    const counts = Object.fromEntries(statuses.map(value => [value, 0])) as Record<Status, number>;
    for (const row of grouped.results) counts[row.status] = row.count;
    return Response.json({ items: result.results.slice(0, 50), hasMore: result.results.length > 50, total: total?.count ?? 0, counts } satisfies ConsultationList);
  }
  const match = /^\/api\/consultations\/([^/]+)(\/notify)?$/.exec(url.pathname);
  if (!match || !isId(match[1])) throw new HttpError(404, '相談が見つかりません。');
  const id = match[1];
  if (match[2] && request.method === 'POST') {
    await jsonBody(request);
    if (!await db.prepare('SELECT id FROM consultations WHERE id = ?').bind(id).first()) throw new HttpError(404, '相談が見つかりません。');
    await notifyConsultation(db, env, id);
  } else if (!match[2] && request.method === 'PATCH') {
    const body = await jsonBody(request) as { status?: unknown; note?: unknown; revision?: unknown } | null;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['status', 'note', 'revision'].includes(key))
      || !(statuses as readonly unknown[]).includes(body.status) || typeof body.note !== 'string' || body.note.length > 4000
      || !Number.isSafeInteger(body.revision) || Number(body.revision) < 0) throw new HttpError(400, '対応状況とメモを確認してください。');
    const result = await db.prepare('UPDATE consultations SET status = ?, note = ?, revision = revision + 1 WHERE id = ? AND revision = ?')
      .bind(body.status as string, body.note, id, body.revision as number).run();
    if (result.meta.changes !== 1) throw new HttpError(409, '別の操作で更新されています。詳細を開き直して確認してください。');
  } else if (match[2] || request.method !== 'GET') return new Response(null, { status: 405 });
  const item = await db.prepare(`SELECT ${selectColumns} FROM consultations WHERE id = ?`).bind(id).first();
  if (!item) throw new HttpError(404, '相談が見つかりません。');
  return Response.json(item);
}
