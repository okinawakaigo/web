import { notificationRepository } from './db/notifications';

export interface MailEnv {
  RESEND_API_KEY?: string;
  NOTIFICATION_FROM?: string;
  NOTIFICATION_TO?: string;
  DASHBOARD_URL?: string;
}
/** Send only a receipt ID and authenticated dashboard link; no applicant data in email. */
export async function notifyConsultation(db: D1Database, env: MailEnv, id: string): Promise<void> {
  const notifications = notificationRepository(db);
  const row = await notifications.find(id);
  if (!row || row.status === 'sent') return;
  if (!env.RESEND_API_KEY || !env.NOTIFICATION_FROM || !env.NOTIFICATION_TO || !env.DASHBOARD_URL) {
    await notifications.markUnsent(id, 'unconfigured'); return;
  }
  const dashboard = new URL(env.DASHBOARD_URL);
  if (dashboard.protocol !== 'https:' || dashboard.username || dashboard.password) throw new Error('Invalid dashboard URL');
  // Freeze the exact payload for Resend idempotency, even if settings later change.
  dashboard.hash = id;
  const payload = JSON.stringify({ from: env.NOTIFICATION_FROM, to: [env.NOTIFICATION_TO],
    subject: '説明会への参加相談を受け付けました',
    text: `新しい参加相談があります。管理画面で内容を確認してください。\n\n受付番号：${id}\n${dashboard.href}` });
  const saved = await notifications.prepareDelivery(id, new Date().toISOString(), payload);
  if (!saved?.startedAt || !saved.payload) throw new Error('Missing notification');
  // Never retry beyond the provider's 24-hour deduplication window.
  if (Date.now() - Date.parse(saved.startedAt) > 23 * 60 * 60 * 1000) {
    await notifications.markUnsent(id, 'failed'); return;
  }
  try {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `consultation/${id}` },
      body: saved.payload, signal: AbortSignal.timeout(10000),
    });
    const result = await response.json() as { id?: unknown };
    if (!response.ok || typeof result.id !== 'string') throw new Error('Notification rejected');
    await notifications.markSent(id, result.id);
  } catch {
    await notifications.markUnsent(id, 'failed');
  }
}
