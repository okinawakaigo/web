import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, TextArea, TextField } from '@okinawa-care/ui/react';
import type { Consultation } from '@okinawa-care/contracts';
import { defaultReplySubject, replyLimits, type ConsultationReply, type ReplyInput, type ReplyList } from '@okinawa-care/contracts/replies';
import { api, ApiError, errorMessage, formatDate } from '../api';
import Icon from './Icon';

interface Props { item: Consultation; disabled: boolean; onEditorChange(dirty: boolean, busy: boolean): void }
const labels: Record<ConsultationReply['status'], string> = {
  pending: '送信結果の確認が必要', accepted: '送信受付済み', failed: '送信失敗', uncertain: '送信結果の確認が必要', test: 'テスト記録・未送信',
};
const complete = (reply: ConsultationReply) => reply.status === 'accepted' || reply.status === 'test';
const ordered = (items: ConsultationReply[]) => items.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

export default function ReplyThread({ item, disabled, onEditorChange }: Props) {
  const [history, setHistory] = useState<ReplyList | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [subject, setSubject] = useState(defaultReplySubject);
  const [body, setBody] = useState('');
  const [attempt, setAttempt] = useState<ReplyInput | null>(null);
  const [recorded, setRecorded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const mutation = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const dirty = !!body || subject !== defaultReplySubject;
  const base = `/api/consultations/${item.id}/replies`;

  useEffect(() => { onEditorChange(dirty, busy); }, [dirty, busy, onEditorChange]);
  useEffect(() => () => onEditorChange(false, false), [onEditorChange]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setHistoryError('');
    void api<ReplyList>(base, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setHistory(result); })
      .catch(problem => { if (!controller.signal.aborted) setHistoryError(errorMessage(problem)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [base]);
  async function loadHistory(older = false) {
    if (loading) return;
    setLoading(true); setHistoryError('');
    try {
      const result = await api<ReplyList>(base + (older && history?.nextCursor ? `?before=${history.nextCursor}` : ''));
      setHistory(current => older && current ? { ...result, items: [...result.items, ...current.items] } : result);
    } catch (problem) { setHistoryError(errorMessage(problem)); }
    finally { setLoading(false); }
  }
  function clearDraft() { setBody(''); setSubject(defaultReplySubject); setAttempt(null); setRecorded(false); setError(''); }
  function settle(reply: ConsultationReply, draftId?: string) {
    setHistory(current => current ? { ...current, items: ordered([...current.items.filter(row => row.id !== reply.id), reply]) } : current);
    if (reply.id === draftId) {
      if (complete(reply)) clearDraft(); else setRecorded(true);
    }
    if (complete(reply)) setFeedback(reply.status === 'test' ? 'テスト返信を記録しました。メールは送信されていません。' : 'メールの送信を受け付けました。');
    else setError(reply.status === 'failed' ? '送信できませんでした。本文は履歴に保存されています。同じ内容で再試行できます。'
      : '送信結果を確認できませんでした。本文は履歴に保存されています。同じ内容で再試行してください。');
    requestAnimationFrame(() => bottom.current?.scrollIntoView?.({ block: 'nearest' }));
  }
  async function send(event: FormEvent) {
    event.preventDefault(); if (mutation.current || loading || disabled || !history?.settings.available) return;
    mutation.current = true; setBusy(true); setError(''); setFeedback('');
    const input = attempt ?? { id: crypto.randomUUID(), subject, body }; setAttempt(input);
    try {
      const reply = await api<ConsultationReply>(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      settle(reply, input.id);
    } catch (problem) {
      if (problem instanceof ApiError && [400, 401, 403, 413, 415, 429].includes(problem.status)) {
        setAttempt(null); setError(errorMessage(problem));
      } else setError(`${errorMessage(problem)} 入力内容を保持しています。変更せずに再試行してください。`);
    }
    finally { mutation.current = false; setBusy(false); }
  }
  async function retry(reply: ConsultationReply) {
    if (mutation.current || loading || disabled) return;
    mutation.current = true; setBusy(true); setError(''); setFeedback('');
    try {
      const result = await api<ConsultationReply>(`${base}/${reply.id}/retry`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      settle(result, attempt?.id);
    } catch (problem) { setError(errorMessage(problem)); }
    finally { mutation.current = false; setBusy(false); }
  }
  const unavailable = !history?.settings.available;
  return <section className="reply-workspace" aria-labelledby="reply-title">
    <header className="reply-header"><div><h3 id="reply-title"><Icon name="mail" />相談者への返信</h3><p>{item.email}</p></div><Button compact variant="outline" disabled={loading || busy} onClick={() => void loadHistory()}>履歴を更新</Button></header>
    <div className="reply-history" aria-label="相談と送信履歴" aria-busy={loading}>
      {historyError && <p className="reply-error" role="alert">{historyError}</p>}
      {loading && <p className="subtle-text" role="status">履歴を読み込んでいます。</p>}
      <article className="consultation-message"><div className="message-meta"><span>参加相談フォーム</span><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></div><div className="message-paper"><p>説明会への参加相談が届きました。</p><dl><dt>ご都合のよい日時</dt><dd>{item.availability || '未記入'}</dd><dt>説明会で聞きたいこと</dt><dd>{item.questions || '未記入'}</dd></dl></div></article>
      {history?.nextCursor && <div className="reply-older"><Button compact variant="outline" disabled={loading || busy} onClick={() => void loadHistory(true)}>以前の返信を表示</Button></div>}
      {history && history.items.length === 0 && <p className="reply-empty">この相談への返信はまだありません。<br />ご希望を確認し、説明会の日程をご案内しましょう。</p>}
      {history?.items.map(reply => <article className="outgoing-message" key={reply.id} aria-label={`${labels[reply.status]}：${reply.subject}`}>
        <div className="message-meta"><span>担当者 · {reply.sentBy}</span><time dateTime={reply.createdAt}>{formatDate(reply.createdAt)}</time></div>
        <div className="message-paper"><h4>{reply.subject}</h4><p className="message-text">{reply.body}</p><details className="message-addresses"><summary>宛先・送信元</summary><dl><dt>宛先</dt><dd>{reply.to}</dd><dt>送信元</dt><dd>{reply.from}</dd><dt>返信の受信先</dt><dd>{reply.replyTo}</dd></dl></details></div>
        <div className={`message-state message-state--${reply.status}`}><span>{labels[reply.status]}</span>{reply.canRetry && <Button compact variant="outline" disabled={busy || loading || disabled} onClick={() => void retry(reply)}>同じ内容で再試行</Button>}</div>
        {!complete(reply) && !reply.canRetry && <p className="subtle-text">再試行できません。メール設定とResendの送信結果を確認してください。</p>}
      </article>)}
      <div ref={bottom} />
    </div>
    <form className="reply-composer" onSubmit={event => void send(event)} aria-label="メール返信">
      {history?.settings.localTest ? <p className="reply-test-notice">ローカル確認用です。返信を記録しますが、メールは送信しません。</p>
        : history && unavailable ? <p className="reply-test-notice">メール返信の設定が完了していません。</p>
          : history && <p className="reply-routing">送信元：{history.settings.from}<br />相談者からの返信は {history.settings.replyTo} で受信します。</p>}
      <TextField compact id="reply-subject" label="件名" required maxLength={replyLimits.subject} value={subject} onChange={event => setSubject(event.target.value)} disabled={busy || loading || disabled || unavailable} readOnly={!!attempt} />
      <TextArea id="reply-body" label="返信本文" required rows={4} maxLength={replyLimits.body} placeholder="説明会の候補日や、ご相談への回答を入力してください。" value={body} onChange={event => setBody(event.target.value)} disabled={busy || loading || disabled || unavailable} readOnly={!!attempt} />
      {error && <p className="reply-error" role="alert">{error}</p>}
      {feedback && <p className="save-feedback" role="status">{feedback}</p>}
      {attempt && <p className="subtle-text">重複送信を防ぐため、この返信の内容を固定しています。{recorded && <button className="reply-reset" type="button" disabled={busy} onClick={clearDraft}>履歴に残して入力を終える</button>}</p>}
      <div className="reply-actions"><span className="subtle-text">{body.length.toLocaleString()} / 6,000文字</span><Button compact type="submit" disabled={busy || loading || disabled || unavailable || !subject.trim() || !body.trim()}>{busy ? '処理中…' : attempt ? '同じ返信を再試行' : history?.settings.localTest ? 'テスト返信を記録' : 'メールを送信'}</Button></div>
      <p className="reply-footnote">送信受付済みのメールの配信結果はResendで確認できます。</p>
    </form>
  </section>;
}
