import type { Status } from '@okinawa-care/contracts';
const tones: Record<Status, string> = { 未対応: 'attention', 連絡済み: 'progress', 日程確定: 'scheduled', 対応完了: 'complete' };
export default function StatusBadge({ status }: { status: Status }) {
  return <span className={`status-badge status-badge--${tones[status]}`}>{status}</span>;
}
