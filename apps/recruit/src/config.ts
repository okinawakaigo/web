import { reservationIsConfigured, type ReservationConfig } from '@okinawa-care/content/attribution';

export const reservation: ReservationConfig = {
  url: import.meta.env.PUBLIC_RESERVATION_URL ?? '',
  fields: {
    source: import.meta.env.PUBLIC_FORM_SOURCE_FIELD ?? '',
    medium: import.meta.env.PUBLIC_FORM_MEDIUM_FIELD ?? '',
    role: import.meta.env.PUBLIC_FORM_ROLE_FIELD ?? '',
    step: import.meta.env.PUBLIC_FORM_STEP_FIELD ?? '',
  },
};
// An invalid configured form is a build error, never a broken production CTA.
if (reservation.url && !reservationIsConfigured(reservation)) {
  throw new Error('予約フォーム設定を確認してください: docs.google.com/forms/d/e/.../viewform と、重複のない4つの entry.ID が必要です。');
}
export const hasReservation = reservationIsConfigured(reservation);
export const indexable = import.meta.env.PUBLIC_SITE_INDEXABLE === 'true';
