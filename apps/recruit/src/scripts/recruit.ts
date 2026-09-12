import { readAttribution, type EventName } from '@okinawa-care/content/attribution';

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
document.querySelectorAll<HTMLAnchorElement>('[data-role]').forEach(link => {
  link.addEventListener('click', () => { if (roleSelect && link.dataset.role) roleSelect.value = link.dataset.role; });
});

interface Turnstile {
  render(target: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  getResponse(id: string): string;
}
declare global { interface Window { turnstile?: Turnstile; } }
const fields = document.querySelector<HTMLFieldSetElement>('#reservation-fields');
const submit = document.querySelector<HTMLButtonElement>('#reservation-submit');
const status = document.querySelector<HTMLElement>('#reservation-status');
const error = document.querySelector<HTMLElement>('#reservation-error');
let localTest = false;
let widget: string | undefined;
let pending = false;
// Keep one receipt ID for this form, including uncertain network outcomes.
const submissionId = crypto.randomUUID();
async function initForm() {
  if (!reservationForm || !fields || !submit || !status) return;
  if (reservationForm.dataset.enabled !== 'true') { status.textContent = '説明会への参加相談は、ただいま受付準備中です。'; return; }
  try {
    const response = await fetch('/api/consultations', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error();
    const config = await response.json();
    if (!config.ready) throw new Error();
    localTest = config.localTest === true;
    if (!localTest) {
      if (!reservationForm.dataset.sitekey) throw new Error();
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.onload = () => resolve(); script.onerror = reject; document.head.append(script);
      });
      widget = window.turnstile!.render(document.querySelector<HTMLElement>('#turnstile')!, {
        sitekey: reservationForm.dataset.sitekey, action: 'consultation', size: 'flexible',
      });
    }
    fields.disabled = false; submit.disabled = false; submit.textContent = '参加相談を送信する';
    status.textContent = '';
  } catch { status.textContent = 'ただいま受付を利用できません。時間をおいてページを開き直してください。'; }
}
void initForm();
reservationForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (pending || !fields || fields.disabled || !submit || !error || !reservationForm.reportValidity()) return;
  const data = new FormData(reservationForm);
  const values = Object.fromEntries(['name','email','role','ageGroup','gender','availability','questions'].map(key => [key, String(data.get(key) ?? '')]));
  const payload = { ...values, ...attribution, consent: data.get('consent') === 'on' };
  const turnstileToken = localTest ? '' : (widget && window.turnstile?.getResponse(widget)) || '';
  if (!localTest && !turnstileToken) { error.hidden = false; error.textContent = '送信前の確認が完了するまでお待ちください。'; return; }
  pending = true; fields.disabled = true; submit.disabled = true; submit.textContent = '送信しています…'; error.hidden = true;
  try {
    const response = await fetch('/api/consultations', { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: submissionId, ...payload, turnstileToken }), signal: AbortSignal.timeout(20000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || '送信できませんでした。');
    if (result.id !== submissionId) throw new Error('受付結果を確認できませんでした。');
    reservationForm.hidden = true; reservationForm.reset();
    const success = document.querySelector<HTMLElement>('#reservation-success')!;
    document.querySelector('#receipt-number')!.textContent = `受付番号：${result.id}`;
    success.hidden = false; success.focus();
  } catch (problem) {
    error.hidden = false; error.textContent = problem instanceof Error && problem.name !== 'TimeoutError' ? problem.message : '受付結果を確認できませんでした。入力内容を残したまま、もう一度送信してください。';
    if (widget) window.turnstile?.reset(widget);
  } finally { pending = false; fields.disabled = false; submit.disabled = false; submit.textContent = '参加相談を送信する'; }
});
