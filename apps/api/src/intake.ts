import { parseConsultation, type ConsultationInput } from '@okinawa-care/contracts';
import { readAttribution } from '@okinawa-care/content/attribution';
import { HttpError, jsonBody, loopback } from './http';
import { notifyConsultation, type MailEnv } from './mail';
import { intakeRepository } from './db/intake';

export interface IntakeEnv extends MailEnv {
  DB?: D1Database;
  CONSULTATION_ENABLED?: string;
  TURNSTILE_SECRET_KEY?: string;
  CONSULTATION_RATE_LIMITER?: RateLimit;
  LOCAL_FORM_TEST?: string;
}
export function ready(env: IntakeEnv, url: URL): boolean {
  return env.CONSULTATION_ENABLED === 'true' && !!env.DB
    && ((loopback(url) && env.LOCAL_FORM_TEST === 'true') || (!!env.TURNSTILE_SECRET_KEY && !!env.CONSULTATION_RATE_LIMITER));
}
/** Public entry point. It only files a consultation and reads back the row it filed; admin queries live in consultations.ts. */
export async function receiveConsultation(request: Request, env: IntakeEnv, ctx?: Pick<ExecutionContext, 'waitUntil'>): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const available = ready(env, url);
    if (available) await intakeRepository(env.DB!).checkAvailable();
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
  const intake = intakeRepository(db);
  await intake.create(input, new Date().toISOString());
  const stored = await intake.find(input.id);
  if (!stored) throw new Error('Insert not confirmed');
  const comparable: (keyof Omit<ConsultationInput, 'consent'>)[] = ['name', 'email', 'role', 'ageGroup', 'gender', 'availability', 'questions', 'source', 'medium'];
  if (comparable.some(key => stored[key] !== input[key])) throw new HttpError(409, '前回の送信内容と異なります。受付状況をご確認のうえ、画面を再読み込みしてください。');
  const notification = notifyConsultation(db, env, input.id).catch(() => { /* The saved consultation remains available to admins. */ });
  if (ctx) ctx.waitUntil(notification); else await notification;
  return Response.json({ id: stored.id, message: '説明会への参加相談を受け付けました。' }, { status: 201 });
}
