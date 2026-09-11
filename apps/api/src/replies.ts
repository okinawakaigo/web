import { isId } from '@okinawa-care/contracts';
import { parseReply, type ConsultationReply, type ReplyList, type ReplySettings } from '@okinawa-care/contracts/replies';
import { HttpError, jsonBody, loopback } from './http';

export interface ReplyEnv {
  DB?: D1Database;
  ADMIN_USERNAME?: string;
  RESEND_API_KEY?: string;
  REPLY_ENABLED?: string;
  REPLY_FROM?: string;
  REPLY_TO?: string;
  LOCAL_MAIL_TEST?: string;
}
interface StoredReply extends Omit<ConsultationReply, 'canRetry'> {
  consultationId: string;
  mode: 'live' | 'test';
  payload: string;
}
const columns = `id, consultation_id AS consultationId, created_at AS createdAt, subject, body,
  from_address AS "from", to_address AS "to", reply_to AS replyTo, sent_by AS sentBy,
  mode, status, payload, accepted_at AS acceptedAt`;
const terminal = (reply: StoredReply) => reply.status === 'accepted' || reply.status === 'test';
const withinRetryWindow = (reply: StoredReply) => Date.now() - Date.parse(reply.createdAt) < 23 * 60 * 60 * 1000;
const mailbox = (value: string) => value.length <= 254 && !/[\x00-\x20\x7f]/.test(value)
  && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
function validFrom(value: string) {
  if (value.length > 320 || /[\x00-\x1f\x7f]/.test(value)) return false;
  return mailbox(value) || /^[^<>]+ <[^<>]+>$/.test(value) && mailbox(value.slice(value.indexOf('<') + 1, -1));
}
export function replySettings(env: ReplyEnv, url: URL): ReplySettings {
  const localTest = loopback(url) && env.LOCAL_MAIL_TEST === 'true';
  if (localTest) return { available: true, localTest, from: 'local-test@example.invalid', replyTo: 'local-test@example.invalid' };
  const from = env.REPLY_FROM?.trim() ?? '';
  const replyTo = env.REPLY_TO?.trim() ?? '';
  const available = env.REPLY_ENABLED === 'true' && !!env.RESEND_API_KEY && validFrom(from) && mailbox(replyTo);
  return { available, localTest: false, from: available ? from : '', replyTo: available ? replyTo : '' };
}
function present(reply: StoredReply, settings: ReplySettings): ConsultationReply {
  const { consultationId: _consultationId, mode, payload: _payload, ...item } = reply;
  return { ...item, canRetry: !terminal(reply) && withinRetryWindow(reply) && settings.available
    && mode === (settings.localTest ? 'test' : 'live') };
}
async function stored(db: D1Database, consultationId: string, id: string) {
  return db.prepare(`SELECT ${columns} FROM consultation_replies WHERE consultation_id = ? AND id = ?`).bind(consultationId, id).first<StoredReply>();
}

async function deliver(db: D1Database, env: ReplyEnv, settings: ReplySettings, reply: StoredReply): Promise<StoredReply> {
  if (terminal(reply)) return reply;
  if (!withinRetryWindow(reply)) throw new HttpError(409, '再試行できる期間を過ぎました。Resendで送信結果を確認してください。');
  if (!settings.available || reply.mode !== (settings.localTest ? 'test' : 'live')) throw new HttpError(503, 'メール返信の設定を確認してください。');
  // Local test records are terminal and can never be promoted into real mail.
  if (reply.mode !== 'live') throw new HttpError(409, 'テスト返信は送信できません。');
  let providerId: string | null = null;
  let failure: 'failed' | 'uncertain' = 'uncertain';
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json',
        'Idempotency-Key': `consultation-reply/${reply.id}` },
      body: reply.payload, signal: AbortSignal.timeout(10000),
    });
    const data = await response.json() as { id?: unknown };
    if (response.ok && typeof data.id === 'string' && data.id.length > 0 && data.id.length <= 200) providerId = data.id;
    // Conflicts, timeouts and server failures can still mean the provider accepted mail.
    else if (response.status >= 400 && response.status < 500 && ![408, 409].includes(response.status)) failure = 'failed';
  } catch { /* A timeout is an unknown outcome, not evidence that nothing was sent. */ }
  if (providerId) {
    await db.prepare("UPDATE consultation_replies SET status = 'accepted', provider_id = ?, accepted_at = COALESCE(accepted_at, ?) WHERE id = ?")
      .bind(providerId, new Date().toISOString(), reply.id).run();
  } else {
    // Concurrent failures must not overwrite an accepted result.
    await db.prepare("UPDATE consultation_replies SET status = ? WHERE id = ? AND status != 'accepted'").bind(failure, reply.id).run();
  }
  const result = await stored(db, reply.consultationId, reply.id);
  if (!result) throw new Error('Missing reply');
  return result;
}

export async function consultationReplies(request: Request, env: ReplyEnv): Promise<Response> {
  const db = env.DB;
  if (!db) throw new HttpError(503, 'データベースが未設定です。');
  const url = new URL(request.url);
  const match = /^\/api\/consultations\/([^/]+)\/replies(?:\/([^/]+)\/retry)?$/.exec(url.pathname);
  if (!match || !isId(match[1]) || (match[2] && !isId(match[2]))) throw new HttpError(404, '返信が見つかりません。');
  const consultationId = match[1];
  const person = await db.prepare('SELECT email FROM consultations WHERE id = ?').bind(consultationId).first<{ email: string }>();
  if (!person) throw new HttpError(404, '相談が見つかりません。');
  const settings = replySettings(env, url);
  if (request.method === 'GET' && !match[2]) {
    const cursor = url.searchParams.get('before');
    let boundary: StoredReply | null = null;
    if (cursor) {
      if (!isId(cursor)) throw new HttpError(400, '履歴の指定を確認してください。');
      boundary = await stored(db, consultationId, cursor);
      if (!boundary) throw new HttpError(400, '履歴の指定を確認してください。');
    }
    const rows = await db.prepare(`SELECT ${columns} FROM consultation_replies WHERE consultation_id = ?
      ${boundary ? 'AND (created_at < ? OR (created_at = ? AND id < ?))' : ''}
      ORDER BY created_at DESC, id DESC LIMIT 51`)
      .bind(consultationId, ...(boundary ? [boundary.createdAt, boundary.createdAt, boundary.id] : [])).all<StoredReply>();
    const page = rows.results.slice(0, 50);
    return Response.json({ items: page.map(row => present(row, settings)).reverse(), settings,
      nextCursor: rows.results.length > 50 ? page.at(-1)!.id : null } satisfies ReplyList);
  }
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const body = await jsonBody(request, 32768);
  if (match[2]) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) throw new HttpError(400, '送信形式を確認してください。');
    const reply = await stored(db, consultationId, match[2]);
    if (!reply) throw new HttpError(404, '返信が見つかりません。');
    return Response.json(present(await deliver(db, env, settings, reply), settings));
  }
  const input = parseReply(body);
  if (!input) throw new HttpError(400, '件名と返信本文を確認してください。');
  let reply = await stored(db, consultationId, input.id);
  if (!reply) {
    if (!settings.available) throw new HttpError(503, 'メール返信の設定が完了していません。');
    if (!mailbox(person.email)) throw new HttpError(400, '相談者のメールアドレスを確認してください。');
    const payload = JSON.stringify({ from: settings.from, to: [person.email], reply_to: settings.replyTo,
      subject: input.subject, text: input.body });
    await db.prepare(`INSERT INTO consultation_replies
      (id, consultation_id, created_at, subject, body, from_address, to_address, reply_to, sent_by, mode, status, payload)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
      .bind(input.id, consultationId, new Date().toISOString(), input.subject, input.body, settings.from, person.email,
        settings.replyTo, env.ADMIN_USERNAME ?? 'admin', settings.localTest ? 'test' : 'live', settings.localTest ? 'test' : 'pending', payload).run();
    reply = await stored(db, consultationId, input.id);
  }
  if (!reply || reply.subject !== input.subject || reply.body !== input.body) throw new HttpError(409, '前回の返信内容と異なります。送信履歴を確認してください。');
  return Response.json(present(await deliver(db, env, settings, reply), settings));
}
