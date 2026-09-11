export const hasReservation = import.meta.env.PUBLIC_CONSULTATION_ENABLED === 'true';
export const turnstileSiteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? '';
export const indexable = import.meta.env.PUBLIC_SITE_INDEXABLE === 'true';
