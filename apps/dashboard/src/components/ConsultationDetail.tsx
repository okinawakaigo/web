import { Fragment, useEffect, useRef } from 'react';
import { Button, SelectField, TextArea } from '@okinawa-care/ui/react';
import { statuses, type Status } from '@okinawa-care/contracts';
import { formatDate, notificationLabels } from '../api';
import Icon from './Icon';
import StatusBadge from './StatusBadge';
import { useConsultationEditor } from '../hooks/useConsultationEditor';

interface DetailProps {
  id: string;
  onChange(): void;
  onClose?(): void;
  onEditorChange?(dirty: boolean, busy: boolean): void;
}
const sourceLabels: Record<string, string> = { instagram: 'Instagram', indeed: 'Indeed', jwarm: 'ジェイウォーム', corp: '会社サイト', qr: 'QRコード', direct: '直接アクセス' };
const mediumLabels: Record<string, string> = { bio: 'プロフィール', highlight: 'ハイライト', post: '投稿', listing: '求人掲載', link: 'リンク', print: '印刷物', none: '指定なし' };

export default function ConsultationDetail(props: DetailProps) {
  return <ConsultationDetailPanel key={props.id} {...props} />;
}

function ConsultationDetailPanel({ id, onChange, onClose, onEditorChange }: DetailProps) {
  const { item, status, note, loading, busy, error, feedback, dirty, edit, save, retryNotification, reload } = useConsultationEditor(id, onChange, onEditorChange);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const modal = !!onClose;
  const itemId = item?.id;

  useEffect(() => {
    if (!modal) return;
    const panel = dialog.current!; panel.showModal();
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { panel.close(); document.body.style.overflow = previous; };
  }, [modal]);
  useEffect(() => { if (itemId && !loading) heading.current?.focus(); }, [itemId, loading]);

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
      {error && <div className="detail-error" role="alert"><p>{error}</p>{!loading && <Button compact variant="outline" disabled={busy} onClick={() => { if (!dirty || window.confirm('編集中の変更を破棄して、保存済みの内容を読み直しますか？')) reload(); }}>保存済みの内容を読み直す</Button>}</div>}
      {loading && <p className="detail-loading" role="status">詳細を読み込んでいます。</p>}
      {item && !loading && <>
        <section className="detail-section" aria-labelledby="contact-title"><h3 id="contact-title">連絡先</h3><div className="detail-contact"><a className="button button--primary button--compact" href={`mailto:${encodeURIComponent(item.email)}`}><span><Icon name="mail" width="16" height="16" />メールで連絡する</span></a><span className="contact-email">{item.email}</span></div><p className="subtle-text">ご希望の日時を確認し、説明会の日程を調整してください。</p></section>
        <section className="detail-section" aria-labelledby="answers-title"><h3 id="answers-title">相談内容</h3><dl className="detail-facts">{values.map(([label, value]) => <Fragment key={label}><dt>{label}</dt><dd>{value || '未回答'}</dd></Fragment>)}</dl><dl className="detail-answers"><dt>ご都合のよい日時</dt><dd>{item.availability || '未記入'}</dd><dt>説明会で聞きたいこと</dt><dd>{item.questions || '未記入'}</dd></dl></section>
        <form id="consultation-update" className="detail-section detail-edit" onSubmit={event => { event.preventDefault(); void save(); }}><div className="detail-section-heading"><h3>対応の記録</h3><span className="subtle-text">担当者のみ閲覧できます</span></div><SelectField id="detail-status" label="対応状況" value={status} onChange={event => edit({ status: event.target.value as Status })} disabled={busy}>{statuses.map(value => <option key={value}>{value}</option>)}</SelectField><TextArea id="detail-note" label="担当者メモ" rows={4} placeholder="連絡した内容や、次に行うことを記録します。" maxLength={4000} value={note} onChange={event => edit({ note: event.target.value })} disabled={busy} /><p className="note-counter">{note.length.toLocaleString()} / 4,000文字</p></form>
        <details className="detail-metadata"><summary>受付情報・通知状況</summary><dl className="detail-facts"><dt>受付番号</dt><dd className="receipt-id">{item.id}</dd><dt>流入元</dt><dd>{sourceLabels[item.source] ?? item.source}</dd><dt>掲載場所</dt><dd>{mediumLabels[item.medium] ?? item.medium}</dd></dl><div className="detail-notification"><p><Icon name="mail" />{notificationLabels[item.notification]}</p><Button compact onClick={() => void retryNotification()} variant="outline" disabled={busy || item.notification === 'sent' || item.notification === 'unconfigured'}>担当者への通知を再試行</Button><p className="subtle-text">担当者への通知メールの受付状況です。再試行できるのは最初の通知処理から23時間以内です。</p></div></details>
      </>}
    </div>
    {item && !loading && <footer className="detail-footer"><span className={dirty ? 'unsaved-indicator' : 'save-feedback'} role="status">{busy ? '処理しています…' : feedback || (dirty ? '未保存の変更があります' : '変更はありません')}</span><Button compact type="submit" form="consultation-update" disabled={busy || !dirty}>{busy ? '処理中…' : '対応状況を保存'}</Button></footer>}
  </>;
  return modal ? <dialog ref={dialog} className="detail-dialog" aria-labelledby="detail-title" aria-busy={loading || busy} onCancel={event => { event.preventDefault(); if (!busy) onClose?.(); }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose?.(); }}><div className="detail-panel">{content}</div></dialog>
    : <section className="detail-panel" aria-labelledby="detail-title" aria-busy={loading || busy}>{content}</section>;
}
