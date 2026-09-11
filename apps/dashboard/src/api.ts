import type { Consultation } from '@okinawa-care/contracts';

export type { ConsultationList, ConsultationSummary } from '@okinawa-care/contracts';
export const notificationLabels: Record<Consultation['notification'], string> = {
  pending: '通知待ち', sent: '通知メールの受付成功', failed: '通知失敗', unconfigured: '通知未設定',
};
export const formatDate = (iso: string) => new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo',
}).format(new Date(iso));
export const errorMessage = (error: unknown) => error instanceof Error && error.name !== 'TimeoutError'
  ? error.message : '通信を完了できませんでした。時間をおいて再試行してください。';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const signal = init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init, signal });
  if (response.status === 401) throw new Error('管理者としてログインし直してください。');
  if (response.status === 429) throw new Error('ただいま混み合っています。少し時間をおいてください。');
  const data = await response.json().catch(() => { throw new Error('読み込みに失敗しました。時間をおいて再試行してください。'); });
  if (!response.ok) throw new Error(data.message || '読み込みに失敗しました。');
  return data as T;
}
