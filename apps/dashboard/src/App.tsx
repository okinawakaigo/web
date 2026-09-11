import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, TextField } from '@okinawa-care/ui/react';
import { statuses, type ConsultationList, type Status } from '@okinawa-care/contracts';
import { api, errorMessage } from './api';
import { readRoute, routeHref, type DashboardRoute } from './navigation';
import DashboardShell, { type Navigate } from './components/DashboardShell';
import ConsultationTable from './components/ConsultationTable';
import ConsultationDetail from './components/ConsultationDetail';
import TriageBoard from './components/TriageBoard';
import Icon from './components/Icon';

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
  // Counts come from the whole table, so the last successful listing keeps tabs and the sidebar stable while loading.
  const counts = listing?.counts;
  const total = counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : undefined;
  const filtered = !!(query || filter);
  const listRoute = (changes: Partial<DashboardRoute> = {}): DashboardRoute => ({ ...route, page: 'consultations', id: undefined, ...changes });
  const detailHref = (id: string) => routeHref(listRoute({ id }));
  const listHref = (status: Status | '') => routeHref(listRoute({ filter: status, query: '', offset: 0 }));
  const openList = (changes: Partial<DashboardRoute> = {}) => navigate(routeHref(listRoute({ ...changes, offset: 0 })));
  const errorState = <div className="empty-state empty-state--error" role="alert"><h3>相談を読み込めませんでした</h3><p>{error}</p><Button compact variant="outline" onClick={reload}>再試行</Button></div>;
  const emptyState = <div className="empty-state"><span className="empty-icon"><Icon name={filtered ? 'search' : 'inbox'} width="24" height="24" /></span><h3>{filtered ? '条件に合う参加相談はありません' : '参加相談はまだ届いていません'}</h3><p>{filtered ? '検索するお名前や対応状況を変えてお試しください。' : '採用サイトから相談が届くと、ここに表示されます。'}</p>{filtered && <Button compact variant="outline" onClick={() => openList({ filter: '', query: '' })}>絞り込みを解除</Button>}</div>;
  const listState = error ? errorState
    : loading ? <div className="list-loading" role="status"><span>参加相談を読み込んでいます…</span><div className="skeleton-rows" aria-hidden="true"><i /><i /><i /></div></div>
    : !listing?.items.length ? emptyState
    : <ConsultationTable items={listing.items} navigate={navigate} hrefFor={detailHref} />;
  const overview = error ? <section className="inbox-panel" aria-label="対応状況">{errorState}</section>
    : !loading && listing?.total === 0 ? <section className="inbox-panel" aria-label="対応状況">{emptyState}</section>
    : <TriageBoard listing={loading ? null : listing} hrefFor={detailHref} listHref={listHref} navigate={navigate} />;
  const updatedLabel = updatedAt && new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }).format(updatedAt);

  return <DashboardShell route={route} pending={counts?.未対応} navigate={navigate}>
    <div className="page-heading"><h1>{isOverview ? '概要' : '参加相談'}</h1><div className="page-heading-actions">{updatedLabel && <span className="updated-time">最終更新 {updatedLabel}</span>}<Button compact variant="outline" onClick={reload} disabled={loading}><Icon name="refresh" width="16" height="16" />{loading ? '更新中' : '更新'}</Button></div></div>
    {isOverview ? overview : <section className="inbox-panel" aria-label="参加相談一覧" aria-busy={loading}>
      <div className="inbox-toolbar">
        <form className="search-form" role="search" onSubmit={event => { event.preventDefault(); openList({ query: search.trim() }); }}><div className="search-input"><Icon name="search" width="18" height="18" /><TextField compact id="consultation-search" label="お名前・仕事で検索" placeholder="お名前・仕事で検索" type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} /></div><Button compact variant="outline" type="submit">検索</Button></form>
        <div className="filter-tabs" role="group" aria-label="対応状況で絞り込み">{(['', ...statuses] as const).map(status => <button key={status} aria-pressed={filter === status} onClick={() => openList({ filter: status })}>{status || 'すべて'}<span>{status ? counts?.[status] ?? '—' : total ?? '—'}</span></button>)}</div>
      </div>
      {query && <div className="search-summary"><span>「{query}」の検索結果</span><button className="inline-link" onClick={() => openList({ query: '' })}><Icon name="close" width="14" height="14" />検索を解除</button></div>}
      {listState}
      <div className="list-pagination"><p role="status">{loading ? '読み込み中' : error ? '読み込みに失敗しました' : `${listing?.total ?? 0}件${listing?.items.length ? `中 ${offset + 1}〜${offset + listing.items.length}件を表示` : ''}`}</p><div><Button compact variant="outline" onClick={() => navigate(routeHref(listRoute({ offset: Math.max(0, offset - 50) })))} disabled={loading || offset === 0}>前へ</Button><Button compact variant="outline" onClick={() => navigate(routeHref(listRoute({ offset: offset + 50 })))} disabled={loading || !!error || !listing?.hasMore}>次へ</Button></div></div>
    </section>}
    {route.id && <ConsultationDetail key={route.id} id={route.id} onChange={reload} onEditorChange={editorChanged} onClose={() => navigate(routeHref(listRoute()))} />}
  </DashboardShell>;
}
