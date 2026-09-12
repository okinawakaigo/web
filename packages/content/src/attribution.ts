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
