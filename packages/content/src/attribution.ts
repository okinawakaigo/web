// Free-text URL parameters are deliberately never forwarded or stored.
export const sourceMediums = {
  instagram: ['bio', 'highlight', 'post'],
  indeed: ['listing'], jwarm: ['listing'], corp: ['link'], qr: ['print'],
} as const;
export type Source = keyof typeof sourceMediums | 'direct';
export type Attribution = { source: Source; medium: string };
export const eventNames = ['page_view', 'reserve_view', 'form_open'] as const;
export type EventName = typeof eventNames[number];

export function readAttribution(params: URLSearchParams): Attribution {
  const source = params.get('utm_source') ?? '';
  const medium = params.get('utm_medium') ?? '';
  if (!Object.hasOwn(sourceMediums, source)) return { source: 'direct', medium: 'none' };
  const validMediums: readonly string[] = sourceMediums[source as keyof typeof sourceMediums];
  return { source: source as Source, medium: validMediums.includes(medium) ? medium : 'none' };
}

export interface ReservationConfig {
  url: string;
  fields: { source: string; medium: string; role: string; step: string };
}

export function reservationIsConfigured(config: ReservationConfig): boolean {
  try {
    const url = new URL(config.url);
    return url.protocol === 'https:' && url.hostname === 'docs.google.com'
      && /^\/forms\/d\/e\/[\w-]+\/viewform$/.test(url.pathname)
      && Object.values(config.fields).every(field => /^entry\.\d+$/.test(field))
      && new Set(Object.values(config.fields)).size === 4;
  } catch { return false; }
}

export function buildReservationUrl(config: ReservationConfig, attribution: Attribution, role: string, step: string): string | null {
  if (!reservationIsConfigured(config)) return null;
  const url = new URL(config.url);
  url.search = ''; // Keep only the explicitly configured prefill fields.
  url.hash = '';
  url.searchParams.set('usp', 'pp_url');
  url.searchParams.set(config.fields.source, attribution.source);
  url.searchParams.set(config.fields.medium, attribution.medium);
  url.searchParams.set(config.fields.role, role);
  url.searchParams.set(config.fields.step, step);
  return url.href;
}
