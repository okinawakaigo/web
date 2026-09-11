import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, SelectField, TextArea } from '@okinawa-care/ui/react';
import { statuses, type Consultation, type Status } from '@okinawa-care/contracts';
import { api, errorMessage, formatDate, notificationLabels } from '../api';
import Icon from './Icon';
import StatusBadge from './StatusBadge';

interface DetailProps {
  id: string;
  onChange(): void;
  onClose?(): void;
  onEditorChange?(dirty: boolean, busy: boolean): void;
}
const sourceLabels: Record<string, string> = { instagram: 'Instagram', indeed: 'Indeed', jwarm: 'ジェイウォーム', corp: '会社サイト', qr: 'QRコード', direct: '直接アクセス' };
const mediumLabels: Record<string, string> = { bio: 'プロフィール', highlight: 'ハイライト', post: '投稿', listing: '求人掲載', link: 'リンク', print: '印刷物', none: '指定なし' };

export default function ConsultationDetail({ id, onChange, onClose, onEditorChange }: DetailProps) {
  const [item, setItem] = useState<Consultation | null>(null);
  const [status, setStatus] = useState<Status>('未対応');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const mutation = useRef(false);
  const dirty = !!item && (status !== item.status || note !== item.note);
  const modal = !!onClose;

  useEffect(() => {
    if (!modal) return;
    const panel = dialog.current!; panel.showModal();
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { panel.close(); document.body.style.overflow = previous; };
  }, [modal]);
  useEffect(() => { onEditorChange?.(dirty, busy); }, [dirty, busy, onEditorChange]);
  useEffect(() => () => onEditorChange?.(false, false), [onEditorChange]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setFeedback('');
    void api<Consultation>(`/api/consultations/${id}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setItem(result); setStatus(result.status); setNote(result.note); heading.current?.focus(); } })
      .catch(problem => { if (!controller.signal.aborted) setError(errorMessage(problem)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, refresh]);

  async function save(event: FormEvent) {
    event.preventDefault(); if (!item || mutation.current) return;
    mutation.current = true; setBusy(true); setError(''); setFeedback('');
    try {
      const result = await api<Consultation>(`/api/consultations/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, note, revision: item.revision }) });
      setItem(result); setStatus(result.status); setNote(result.note); setFeedback('保存しました。'); onChange();
    } catch (problem) { setError(errorMessage(problem)); }
    finally { mutation.current = false; setBusy(false); }
  }
  async function retryNotification() {
    if (!item || mutation.current) return;
    mutation.current = true; setBusy(true); setError(''); setFeedback('');
    try {
      const result = await api<Consultation>(`/api/consultations/${id}/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      // Notification updates must preserve drafts and their original revision.
      setItem(current => current ? { ...current, notification: result.notification } : current);
      setFeedback(notificationLabels[result.notification]); onChange();
    } catch (problem) { setError(errorMessage(problem)); }
    finally { mutation.current = false; setBusy(false); }
  }
  const values: [string, string][] = item ? [
    ['気になっている仕事', item.role], ['年齢層', item.ageGroup], ['性別', item.gender],
  ] : [];
  const content = <>
    <header className="detail-header">
      <div>
        <p className="detail-eyebrow">説明会への参加相談</p>
        <h2 id="detail-title" ref={heading} tabIndex={-1}>{item?.name ?? '相談の詳細'}</h2>
        {item && <p className="detail-meta"><StatusBadge status={item.status} /><time dateTime={item.createdAt}>{formatDate(item.createdAt)} 受付</time></p>}
      </div>
      {onClose && <button className="icon-button" aria-label="詳細を閉じる" onClick={onClose} disabled={busy}><Icon name="close" /></button>}
    </header>
    <div className="detail-body">
      {error && <div className="detail-error" role="alert"><p>{error}</p>{!loading && <Button compact variant="outline" disabled={busy} onClick={() => { if (!dirty || window.confirm('編集中の変更を破棄して、保存済みの内容を読み直しますか？')) setRefresh(value => value + 1); }}>保存済みの内容を読み直す</Button>}</div>}
      {loading && <p className="detail-loading" role="status">詳細を読み込んでいます。</p>}
      {item && !loading && <>
        <section className="detail-section" aria-labelledby="contact-title"><h3 id="contact-title">連絡先</h3><div className="detail-contact"><a className="button button--primary button--compact" href={`mailto:${encodeURIComponent(item.email)}`}><span><Icon name="mail" width="16" height="16" />メールで連絡する</span></a><span className="contact-email">{item.email}</span></div><p className="subtle-text">ご希望の日時を確認し、説明会の日程を調整してください。</p></section>
        <section className="detail-section" aria-labelledby="answers-title"><h3 id="answers-title">相談内容</h3><dl className="detail-facts">{values.map(([label, value]) => <Fragment key={label}><dt>{label}</dt><dd>{value || '未回答'}</dd></Fragment>)}</dl><dl className="detail-answers"><dt>ご都合のよい日時</dt><dd>{item.availability || '未記入'}</dd><dt>説明会で聞きたいこと</dt><dd>{item.questions || '未記入'}</dd></dl></section>
        <form id="consultation-update" className="detail-section detail-edit" onSubmit={event => void save(event)}><div className="detail-section-heading"><h3>対応の記録</h3><span className="subtle-text">担当者のみ閲覧できます</span></div><SelectField id="detail-status" label="対応状況" value={status} onChange={event => { setStatus(event.target.value as Status); setFeedback(''); }} disabled={busy}>{statuses.map(value => <option key={value}>{value}</option>)}</SelectField><TextArea id="detail-note" label="担当者メモ" rows={4} placeholder="連絡した内容や、次に行うことを記録します。" maxLength={4000} value={note} onChange={event => { setNote(event.target.value); setFeedback(''); }} disabled={busy} /><p className="note-counter">{note.length.toLocaleString()} / 4,000文字</p></form>
        <details className="detail-metadata"><summary>受付情報・通知状況</summary><dl className="detail-facts"><dt>受付番号</dt><dd className="receipt-id">{item.id}</dd><dt>流入元</dt><dd>{sourceLabels[item.source] ?? item.source}</dd><dt>掲載場所</dt><dd>{mediumLabels[item.medium] ?? item.medium}</dd></dl><div className="detail-notification"><p><Icon name="mail" />{notificationLabels[item.notification]}</p><Button compact onClick={() => void retryNotification()} variant="outline" disabled={busy || item.notification === 'sent' || item.notification === 'unconfigured'}>担当者への通知を再試行</Button><p className="subtle-text">担当者への通知メールの受付状況です。再試行できるのは最初の通知処理から23時間以内です。</p></div></details>
      </>}
    </div>
    {item && !loading && <footer className="detail-footer"><span className={dirty ? 'unsaved-indicator' : 'save-feedback'} role="status">{busy ? '処理しています…' : feedback || (dirty ? '未保存の変更があります' : '変更はありません')}</span><Button compact type="submit" form="consultation-update" disabled={busy || !dirty}>{busy ? '処理中…' : '対応状況を保存'}</Button></footer>}
  </>;
  return modal ? <dialog ref={dialog} className="detail-dialog" aria-labelledby="detail-title" aria-busy={loading || busy} onCancel={event => { event.preventDefault(); if (!busy) onClose?.(); }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose?.(); }}><div className="detail-panel">{content}</div></dialog>
    : <section className="detail-panel" aria-labelledby="detail-title" aria-busy={loading || busy}>{content}</section>;
}
