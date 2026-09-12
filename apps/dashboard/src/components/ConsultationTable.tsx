import type { ConsultationSummary } from '@okinawa-care/contracts';
import { formatDate, formatRelative, notificationLabels } from '../api';
import type { Navigate } from './DashboardShell';
import StatusBadge from './StatusBadge';

export default function ConsultationTable({ items, navigate, hrefFor }: {
  items: ConsultationSummary[]; navigate: Navigate; hrefFor(id: string): string;
}) {
  return <div className="table-scroll"><table className="consultation-table">
    <caption className="sr-only">説明会への参加相談。お名前を選択すると詳細が開きます。</caption>
    <thead><tr><th scope="col">お名前</th><th scope="col" className="role-column">気になっている仕事</th><th scope="col">対応状況</th><th scope="col" className="date-column">受付</th><th scope="col" className="notice-column">担当者への通知</th></tr></thead>
    <tbody>{items.map(item => <tr key={item.id} onClick={event => {
      if (!(event.target as Element).closest('a') && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) navigate(hrefFor(item.id));
    }}>
      <td><a className="consultation-link" href={hrefFor(item.id)} onClick={event => navigate(hrefFor(item.id), event)}><span className="person-name">{item.name}</span><span className="mobile-person-meta"><span>{item.role}</span><time dateTime={item.createdAt}>{formatRelative(item.createdAt)}</time></span></a></td>
      <td className="role-column">{item.role}</td>
      <td><StatusBadge status={item.status} /></td>
      <td className="date-column"><time dateTime={item.createdAt} title={formatDate(item.createdAt)}>{formatRelative(item.createdAt)}</time></td>
      <td className="notice-column">{item.notification !== 'sent' && <span className={item.notification === 'failed' ? 'notice--error' : undefined}>{notificationLabels[item.notification]}</span>}</td>
    </tr>)}</tbody>
  </table></div>;
}
