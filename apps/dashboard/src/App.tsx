import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, TextField } from '@okinawa-care/ui/react';
import { statuses, type ConsultationList } from '@okinawa-care/contracts';
import { api, errorMessage } from './api';
import { readRoute, routeHref, type DashboardRoute } from './navigation';
import DashboardShell, { type Navigate } from './components/DashboardShell';
import ConsultationTable from './components/ConsultationTable';
import ConsultationDetail from './components/ConsultationDetail';
import Icon from './components/Icon';
import StatusBadge from './components/StatusBadge';

export default function App() {
  const [route, setRoute] = useState(readRoute);
  const currentRoute = useRef(route);
  const editor = useRef({ dirty: false, busy: false });
  const [refresh, setRefresh] = useState(0);
  const [listing, setListing] = useState<ConsultationList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [search, setSearch] = useState(route.query);
  const reload = useCallback(() => setRefresh(value => value + 1), []);
  const editorChanged = useCallback((dirty: boolean, busy: boolean) => { editor.current = { dirty, busy }; }, []);
  const mayLeave = useCallback(() => !editor.current.busy && (!editor.current.dirty || window.confirm('保存していない変更があります。変更を破棄して移動しますか？')), []);
  const acceptRoute = useCallback((next: DashboardRoute) => { currentRoute.current = next; setRoute(next); editor.current = { dirty: false, busy: false }; }, []);
  const navigate: Navigate = useCallback((href, event) => {
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)) return;
    event?.preventDefault();
    if (href === routeHref(currentRoute.current) || !mayLeave()) return;
    const next = readRoute(href); history.pushState(null, '', routeHref(next)); acceptRoute(next);
  }, [acceptRoute, mayLeave]);

  useEffect(() => {
    const change = () => {
      if (!mayLeave()) { history.replaceState(null, '', routeHref(currentRoute.current)); return; }
      acceptRoute(readRoute());
    };
    const unload = (event: BeforeUnloadEvent) => { if (editor.current.dirty || editor.current.busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('hashchange', change); window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener('hashchange', change); window.removeEventListener('beforeunload', unload); };
  }, [acceptRoute, mayLeave]);
  useEffect(() => { setSearch(route.query); }, [route.query]);
  useEffect(() => { document.title = `${route.page === 'overview' ? '概要' : '参加相談'}｜沖縄介護センター ダッシュボード`; }, [route.page]);

  const filter = route.page === 'consultations' ? route.filter : '';
  const offset = route.page === 'consultations' ? route.offset : 0;
  const query = route.page === 'consultations' ? route.query : '';
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const params = new URLSearchParams({ status: filter, offset: String(offset), q: query });
    void api<ConsultationList>(`/api/consultations?${params}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setListing(result); setUpdatedAt(new Date()); } })
      .catch(problem => { if (!controller.signal.aborted) setError(errorMessage(problem)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filter, offset, query, refresh]);

  const isOverview = route.page === 'overview';
  const counts = !loading && !error ? listing?.counts : undefined;
  const total = counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : undefined;
  const listRoute = (changes: Partial<DashboardRoute> = {}): DashboardRoute => ({ ...route, page: 'consultations', id: undefined, ...changes });
  const detailHref = (id: string) => routeHref(listRoute({ id }));
  const openList = (changes: Partial<DashboardRoute> = {}) => navigate(routeHref(listRoute({ ...changes, offset: 0 })));
  const contentState = error ? <div className="empty-state empty-state--error" role="alert"><Icon name="inbox" width="30" height="30" /><h3>相談を読み込めませんでした</h3><p>{error}</p><Button compact variant="outline" onClick={reload}>再試行</Button></div>
    : loading ? <div className="list-loading" role="status"><span>参加相談を読み込んでいます…</span><div className="skeleton-rows" aria-hidden="true"><i /><i /><i /></div></div>
    : !listing?.items.length ? <div className="empty-state"><span className="empty-icon"><Icon name={query || filter ? 'search' : 'inbox'} width="28" height="28" /></span><h3>{query || filter ? '条件に合う参加相談はありません' : '参加相談はまだ届いていません'}</h3><p>{query || filter ? '検索するお名前や対応状況を変えてお試しください。' : '採用サイトから相談が届くと、ここに表示されます。'}</p>{(query || filter) && <Button compact variant="outline" onClick={() => openList({ filter: '', query: '' })}>絞り込みを解除</Button>}</div>
    : <ConsultationTable items={isOverview ? listing.items.slice(0, 5) : listing.items} navigate={navigate} hrefFor={detailHref} />;

  return <DashboardShell route={route} pending={counts?.未対応} navigate={navigate}>
    <div className="page-heading"><div><h1>{isOverview ? '概要' : '参加相談'}</h1><p>{isOverview ? '日々の業務を、ここから。まずは届いた相談を確認しましょう。' : '説明会への参加相談を確認し、日程調整と対応を進めます。'}</p></div><div className="page-heading-actions">{updatedAt && <span className="updated-time">最終更新 {new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }).format(updatedAt)}</span>}<Button compact variant="outline" onClick={reload} disabled={loading}><Icon name="refresh" />{loading ? '更新中' : '更新'}</Button></div></div>
    {isOverview ? <>
      <section className="overview-summary" aria-labelledby="summary-title" aria-busy={loading}>
        <div className="section-toolbar"><div className="section-title"><Icon name="people" /><h2 id="summary-title">採用の対応状況</h2></div><span className="subtle-text">全期間</span></div>
        <div className="status-metrics">{statuses.map(status => <button key={status} className={`status-metric ${status === '未対応' ? 'status-metric--priority' : ''}`} onClick={() => openList({ filter: status })}><StatusBadge status={status} /><span className="metric-value">{counts?.[status] ?? '—'}<small>件</small></span><span className="metric-action">{({ 未対応: '最初の連絡へ', 連絡済み: '日程調整を進める', 日程確定: '参加予定を確認', 対応完了: 'これまでの対応' })[status]}<Icon name="arrow" width="16" height="16" /></span></button>)}</div>
        <div className="summary-footnote"><span>{error ? '対応状況を取得できませんでした。下の「再試行」を押してください。' : total === undefined ? '受付状況を確認しています。' : counts?.未対応 ? `未対応の相談が${counts.未対応}件あります。内容を確認して、メールでご連絡ください。` : '未対応の相談はありません。新しい相談が届いたら、ここから確認できます。'}</span><span>{total !== undefined && `累計 ${total}件`}</span></div>
      </section>
      <section className="inbox-panel" aria-labelledby="recent-title" aria-busy={loading}><div className="section-toolbar"><div><h2 id="recent-title">最近の参加相談</h2><p className="subtle-text">新しく届いた順に、最大5件を表示しています。</p></div><a className="inline-link" href="#consultations" onClick={event => navigate('#consultations', event)}>すべて見る<Icon name="arrow" width="16" height="16" /></a></div>{contentState}</section>
    </> : <section className="inbox-panel" aria-label="参加相談一覧" aria-busy={loading}>
      <div className="inbox-toolbar"><form className="search-form" role="search" onSubmit={event => { event.preventDefault(); openList({ query: search.trim() }); }}><div className="search-input"><Icon name="search" /><TextField compact id="consultation-search" label="お名前・仕事で検索" placeholder="お名前・仕事で検索" type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} /></div><Button compact variant="outline" type="submit">検索</Button></form><span className="subtle-text">受付日時が新しい順</span></div>
      <div className="filter-tabs" role="group" aria-label="対応状況で絞り込み">{(['', ...statuses] as const).map(status => <button key={status} aria-pressed={filter === status} onClick={() => openList({ filter: status })}>{status || 'すべて'}<span>{status ? counts?.[status] ?? '—' : total ?? '—'}</span></button>)}</div>
      {query && <div className="search-summary"><span>「{query}」の検索結果</span><button className="inline-link" onClick={() => openList({ query: '' })}><Icon name="close" width="14" height="14" />検索を解除</button></div>}
      {contentState}
      <div className="list-pagination"><p role="status">{loading ? '読み込み中' : error ? '読み込みに失敗しました' : `${listing?.total ?? 0}件${listing?.items.length ? `中 ${offset + 1}〜${offset + listing.items.length}件を表示` : ''}`}</p><div><Button compact variant="outline" onClick={() => navigate(routeHref(listRoute({ offset: Math.max(0, offset - 50) })))} disabled={loading || offset === 0}>前へ</Button><Button compact variant="outline" onClick={() => navigate(routeHref(listRoute({ offset: offset + 50 })))} disabled={loading || !!error || !listing?.hasMore}>次へ</Button></div></div>
    </section>}
    {route.id && <ConsultationDetail key={route.id} id={route.id} onChange={reload} onEditorChange={editorChanged} onClose={() => navigate(routeHref(listRoute()))} />}
  </DashboardShell>;
}
