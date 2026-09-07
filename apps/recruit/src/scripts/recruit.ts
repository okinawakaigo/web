import { buildReservationUrl, readAttribution, type EventName, type ReservationConfig } from '@okinawa-care/content/attribution';

const attribution = readAttribution(new URLSearchParams(location.search));
const telemetryEnabled = import.meta.env.PUBLIC_ANALYTICS_ENABLED === 'true';

function track(event: EventName): void {
  if (!telemetryEnabled || navigator.doNotTrack === '1') return;
  // No cookies, browser storage, IDs, referrer, or arbitrary URL values.
  void fetch('/api/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, ...attribution }),
    keepalive: true, credentials: 'omit',
  }).catch(() => { /* Navigation remains available if measurement is unavailable. */ });
}

track('page_view');
const reserve = document.querySelector('#reserve');
if (reserve && telemetryEnabled && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { track('reserve_view'); observer.disconnect(); }
  }, { threshold: .1 });
  observer.observe(reserve);
}

const reservationForm = document.querySelector<HTMLFormElement>('#reservation-form');
const roleSelect = document.querySelector<HTMLSelectElement>('#reservation-role');
const stepSelect = document.querySelector<HTMLSelectElement>('#reservation-step');
document.querySelectorAll<HTMLAnchorElement>('[data-role]').forEach(link => {
  link.addEventListener('click', () => { if (roleSelect && link.dataset.role) roleSelect.value = link.dataset.role; });
});

reservationForm?.addEventListener('submit', event => {
  event.preventDefault();
  if (!reservationForm.dataset.config) return;
  const error = document.querySelector<HTMLElement>('#reservation-error');
  try {
    const config = JSON.parse(reservationForm.dataset.config ?? '{}') as ReservationConfig;
    const destination = buildReservationUrl(config, attribution, roleSelect?.value ?? 'その他', stepSelect?.value ?? '説明会に参加したい');
    if (!destination) throw new Error('Invalid reservation configuration');
    track('form_open');
    location.assign(destination);
  } catch { if (error) error.hidden = false; }
});
