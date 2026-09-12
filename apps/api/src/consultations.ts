import { isId, statuses, type Status } from '@okinawa-care/contracts';
import { HttpError, jsonBody } from './http';
import { notifyConsultation, type MailEnv } from './mail';
import { consultationRepository } from './db/consultations';

export interface AdminEnv extends MailEnv {
  DB?: D1Database;
}
/** Admin-only listing, detail, status updates and notification retries. Only the dashboard Worker imports this module. */
export async function adminConsultations(request: Request, env: AdminEnv): Promise<Response> {
  const db = env.DB;
  if (!db) throw new HttpError(503, 'データベースが未設定です。');
  const consultations = consultationRepository(db);
  const url = new URL(request.url);
  if (url.pathname === '/api/consultations' && request.method === 'GET') {
    const status = url.searchParams.get('status') ?? '';
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const query = (url.searchParams.get('q') ?? '').trim();
    if ((status && !(statuses as readonly string[]).includes(status)) || !Number.isSafeInteger(offset) || offset < 0 || offset > 1000000 || query.length > 100) throw new HttpError(400, '検索条件を確認してください。');
    return Response.json(await consultations.list({ status: status as Status | '', offset, query }));
  }
  const match = /^\/api\/consultations\/([^/]+)(\/notify)?$/.exec(url.pathname);
  if (!match || !isId(match[1])) throw new HttpError(404, '相談が見つかりません。');
  const id = match[1];
  if (match[2] && request.method === 'POST') {
    await jsonBody(request);
    if (!await consultations.exists(id)) throw new HttpError(404, '相談が見つかりません。');
    await notifyConsultation(db, env, id);
  } else if (!match[2] && request.method === 'PATCH') {
    const body = await jsonBody(request) as { status?: unknown; note?: unknown; revision?: unknown } | null;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['status', 'note', 'revision'].includes(key))
      || !(statuses as readonly unknown[]).includes(body.status) || typeof body.note !== 'string' || body.note.length > 4000
      || !Number.isSafeInteger(body.revision) || Number(body.revision) < 0) throw new HttpError(400, '対応状況とメモを確認してください。');
    const updated = await consultations.update(id, { status: body.status as Status, note: body.note, revision: body.revision as number });
    if (!updated) throw new HttpError(409, '別の操作で更新されています。詳細を開き直して確認してください。');
  } else if (match[2] || request.method !== 'GET') return new Response(null, { status: 405 });
  const item = await consultations.find(id);
  if (!item) throw new HttpError(404, '相談が見つかりません。');
  return Response.json(item);
}
