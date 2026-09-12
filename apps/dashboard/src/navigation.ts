import { isId, statuses, type Status } from '@okinawa-care/contracts';

export interface DashboardRoute {
  page: 'overview' | 'consultations';
  id?: string;
  filter: Status | '';
  query: string;
  offset: number;
}
export const overviewRoute: DashboardRoute = { page: 'overview', filter: '', query: '', offset: 0 };
export function readRoute(hash = location.hash): DashboardRoute {
  const [path, search = ''] = hash.replace(/^#\/?/, '').split('?');
  if (isId(path as unknown)) return { ...overviewRoute, page: 'consultations', id: path };
  if (path !== 'consultations' && !path.startsWith('consultations/')) return overviewRoute;
  const params = new URLSearchParams(search);
  const filter = params.get('status') ?? '';
  const offset = Number(params.get('offset') ?? 0);
  const id = path.split('/')[1];
  return { page: 'consultations', id: isId(id) ? id : undefined,
    filter: (statuses as readonly string[]).includes(filter) ? filter as Status : '',
    query: (params.get('q') ?? '').slice(0, 100),
    offset: Number.isSafeInteger(offset) && offset >= 0 && offset <= 1000000 ? offset : 0 };
}
export function routeHref(route: DashboardRoute): string {
  if (route.page === 'overview') return '#overview';
  const params = new URLSearchParams();
  if (route.filter) params.set('status', route.filter);
  if (route.query) params.set('q', route.query);
  if (route.offset) params.set('offset', String(route.offset));
  return `#consultations${route.id ? `/${route.id}` : ''}${params.size ? `?${params}` : ''}`;
}
