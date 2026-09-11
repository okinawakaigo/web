export interface MailEnv {
  RESEND_API_KEY?: string;
  NOTIFICATION_FROM?: string;
  NOTIFICATION_TO?: string;
  DASHBOARD_URL?: string;
}
/** Send only a receipt ID and authenticated dashboard link; no applicant data in email. */
export async function notifyConsultation(db: D1Database, env: MailEnv, id: string): Promise<void> {
  const row = await db.prepare('SELECT notification, notification_started_at, notification_payload FROM consultations WHERE id = ?').bind(id)
    .first<{ notification: string; notification_started_at: string | null; notification_payload: string | null }>();
  if (!row || row.notification === 'sent') return;
  if (!env.RESEND_API_KEY || !env.NOTIFICATION_FROM || !env.NOTIFICATION_TO || !env.DASHBOARD_URL) {
    await db.prepare("UPDATE consultations SET notification = 'unconfigured' WHERE id = ? AND notification != 'sent'").bind(id).run(); return;
  }
  const dashboard = new URL(env.DASHBOARD_URL);
  if (dashboard.protocol !== 'https:' || dashboard.username || dashboard.password) throw new Error('Invalid dashboard URL');
  // Freeze the exact payload for Resend idempotency, even if settings later change.
  dashboard.hash = id;
  const payload = JSON.stringify({ from: env.NOTIFICATION_FROM, to: [env.NOTIFICATION_TO],
    subject: '説明会への参加相談を受け付けました',
    text: `新しい参加相談があります。管理画面で内容を確認してください。\n\n受付番号：${id}\n${dashboard.href}` });
  await db.prepare('UPDATE consultations SET notification_started_at = COALESCE(notification_started_at, ?), notification_payload = COALESCE(notification_payload, ?) WHERE id = ?')
    .bind(new Date().toISOString(), payload, id).run();
  const saved = await db.prepare('SELECT notification_started_at, notification_payload FROM consultations WHERE id = ?').bind(id)
    .first<{ notification_started_at: string; notification_payload: string }>();
  if (!saved) throw new Error('Missing notification');
  // Never retry beyond the provider's 24-hour deduplication window.
  if (Date.now() - Date.parse(saved.notification_started_at) > 23 * 60 * 60 * 1000) {
    await db.prepare("UPDATE consultations SET notification = 'failed' WHERE id = ? AND notification != 'sent'").bind(id).run(); return;
  }
  try {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `consultation/${id}` },
      body: saved.notification_payload, signal: AbortSignal.timeout(10000),
    });
    const result = await response.json() as { id?: unknown };
    if (!response.ok || typeof result.id !== 'string') throw new Error('Notification rejected');
    await db.prepare("UPDATE consultations SET notification = 'sent', notification_id = ? WHERE id = ?").bind(result.id, id).run();
  } catch {
    await db.prepare("UPDATE consultations SET notification = 'failed' WHERE id = ? AND notification != 'sent'").bind(id).run();
  }
}
