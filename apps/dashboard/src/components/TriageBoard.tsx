import type { ConsultationList, Status } from '@okinawa-care/contracts';
import { formatDate, formatRelative } from '../api';
import type { Navigate } from './DashboardShell';

// Lanes follow the order work moves through. 対応完了 is a count only; the list page holds the archive.
const lanes: { status: Status; tone: string; empty: string }[] = [
  { status: '未対応', tone: 'attention', empty: '未対応の相談はありません。' },
  { status: '連絡済み', tone: 'progress', empty: '返信を待っている相談はありません。' },
  { status: '日程確定', tone: 'scheduled', empty: '参加予定の相談はありません。' },
];
const laneLimit = 5;

export default function TriageBoard({ listing, hrefFor, listHref, navigate }: {
  listing: ConsultationList | null; hrefFor(id: string): string; listHref(status: Status): string; navigate: Navigate;
}) {
  const counts = listing?.counts;
  const total = counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : undefined;
  return <section className="triage" aria-label="対応状況ごとの参加相談" aria-busy={!listing}>
    <div className="triage-lanes">
      {lanes.map(({ status, tone, empty }) => {
        const items = listing?.items.filter(item => item.status === status).slice(0, laneLimit) ?? [];
        const count = counts?.[status];
        const rest = count === undefined ? 0 : count - items.length;
        const href = listHref(status);
        return <section key={status} className={`lane lane--${tone}`} aria-labelledby={`lane-${tone}`}>
          <header className="lane-header"><h3 id={`lane-${tone}`}>{status}</h3><span className="lane-count">{count ?? '—'}<small>件</small></span></header>
          {!listing ? <div className="lane-skeleton" aria-hidden="true"><i /><i /><i /></div>
            : items.length ? <ul className="lane-list">{items.map(item => <li key={item.id}>
              <a href={hrefFor(item.id)} onClick={event => navigate(hrefFor(item.id), event)}>
                <span className="lane-name">{item.name}</span>
                <span className="lane-role">{item.role}</span>
                <time className="lane-time" dateTime={item.createdAt} title={formatDate(item.createdAt)}>{formatRelative(item.createdAt)}</time>
              </a>
            </li>)}</ul>
            : <p className="lane-empty">{empty}</p>}
          {!!count && <footer className="lane-footer"><a href={href} onClick={event => navigate(href, event)}>{status}をすべて見る{rest > 0 && `（他${rest}件）`}</a></footer>}
        </section>;
      })}
    </div>
    <footer className="triage-footer">
      <a href={listHref('対応完了')} onClick={event => navigate(listHref('対応完了'), event)}>対応完了 <strong>{counts?.対応完了 ?? '—'}</strong>件</a>
      <span>{total !== undefined && `累計 ${total}件`}</span>
    </footer>
  </section>;
}
