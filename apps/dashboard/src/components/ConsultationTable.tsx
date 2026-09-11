import type { ConsultationSummary } from '@okinawa-care/contracts';
import { formatDate, notificationLabels } from '../api';
import type { Navigate } from './DashboardShell';
import Icon from './Icon';
import StatusBadge from './StatusBadge';

export default function ConsultationTable({ items, navigate, hrefFor }: {
  items: ConsultationSummary[]; navigate: Navigate; hrefFor(id: string): string;
}) {
  return <div className="table-scroll"><table className="consultation-table">
    <caption className="sr-only">説明会への参加相談。お名前を選択すると詳細が開きます。</caption>
    <thead><tr><th scope="col">お名前</th><th scope="col" className="role-column">気になっている仕事</th><th scope="col">対応状況</th><th scope="col" className="date-column">受付日時</th><th scope="col" className="notification-column">担当者への通知</th><th scope="col"><span className="sr-only">詳細</span></th></tr></thead>
    <tbody>{items.map(item => <tr key={item.id} onClick={event => {
      if (!(event.target as Element).closest('a') && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) navigate(hrefFor(item.id));
    }}>
      <td><a className="consultation-link" href={hrefFor(item.id)} onClick={event => navigate(hrefFor(item.id), event)}><span className="person-avatar" aria-hidden="true">{Array.from(item.name)[0]}</span><span className="person-name">{item.name}<span className="mobile-person-meta">{item.role}</span><time className="mobile-person-meta" dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></span></a></td>
      <td className="role-column">{item.role}</td>
      <td><StatusBadge status={item.status} /></td>
      <td className="date-column"><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></td>
      <td className="notification-column"><span className={`notification-inline ${item.notification === 'failed' ? 'notification-inline--error' : ''}`}><Icon name={item.notification === 'sent' ? 'check' : 'mail'} width="15" height="15" />{item.notification === 'sent' ? '受付済み' : notificationLabels[item.notification]}</span></td>
      <td className="row-action"><Icon name="chevron" width="16" height="16" /></td>
    </tr>)}</tbody>
  </table></div>;
}
