// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Consultation } from '@okinawa-care/contracts';
import type { ConsultationReply, ReplyList } from '@okinawa-care/contracts/replies';
import ReplyThread from './ReplyThread';

const item: Consultation = { id: 'a74608c1-36aa-4c08-9a99-f9d0ca8e54e9', name: '確認用', email: 'person@example.invalid', createdAt: '2026-09-11T01:00:00Z', role: 'その他', ageGroup: '', gender: '', availability: '', questions: '', source: 'direct', medium: 'none', status: '未対応', note: '', revision: 0, notification: 'unconfigured' };
const settings = { available: true, localTest: true, from: 'local@example.invalid', replyTo: 'local@example.invalid' };
const empty: ReplyList = { items: [], nextCursor: null, settings };
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const row = (body: string, extra: Partial<ConsultationReply> = {}): ConsultationReply => ({
  id: '693a7a0e-a66f-4162-89c4-c0b8aeea67b2', subject: '参加相談について', body, createdAt: '2026-09-11T02:00:00Z',
  from: settings.from, to: item.email, replyTo: settings.replyTo, sentBy: 'admin', status: 'test', acceptedAt: null, canRetry: false, ...extra,
});
const mount = () => render(<ReplyThread item={item} disabled={false} onEditorChange={vi.fn()} />);

describe('返信の入力と履歴', () => {
  it('宛先を固定し、成功した返信を履歴へ移して入力欄を空にする', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(empty)).mockImplementationOnce(async (_url, init) => Response.json(row('ご相談ありがとうございます。', JSON.parse(init.body))));
    mount(); await screen.findByText(/ローカル確認用です/);
    const body = screen.getByLabelText('返信本文') as HTMLTextAreaElement;
    fireEvent.change(body, { target: { value: 'ご相談ありがとうございます。' } });
    fireEvent.click(screen.getByRole('button', { name: 'テスト返信を記録' }));
    await screen.findByText('テスト返信を記録しました。メールは送信されていません。');
    expect(body.value).toBe(''); expect(screen.getByText('ご相談ありがとうございます。')).toBeTruthy();
    const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(Object.keys(payload).sort()).toEqual(['body', 'id', 'subject']);
  });
  it('応答が途切れても本文とIDを保持し、同じ内容で再試行する', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(empty)).mockRejectedValueOnce(new Error('通信エラー'))
      .mockImplementationOnce(async (_url, init) => Response.json(row('消えてはいけない返信', JSON.parse(init.body))));
    mount(); await screen.findByText(/ローカル確認用です/);
    const body = screen.getByLabelText('返信本文') as HTMLTextAreaElement;
    fireEvent.change(body, { target: { value: '消えてはいけない返信' } });
    fireEvent.click(screen.getByRole('button', { name: 'テスト返信を記録' }));
    await screen.findByRole('alert'); expect(body.value).toBe('消えてはいけない返信'); expect(body.readOnly).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '同じ返信を再試行' }));
    await screen.findByText('テスト返信を記録しました。メールは送信されていません。');
    expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[1][1].body);
  });
  it('入力エラーでは本文を編集でき、失敗した履歴もテキストとして安全に表示する', async () => {
    const script = '<script>alert("test")</script>';
    fetchMock.mockResolvedValueOnce(Response.json({ ...empty, items: [row(script, { status: 'failed', canRetry: true })] }))
      .mockResolvedValueOnce(Response.json({ message: '件名と返信本文を確認してください。' }, { status: 400 }));
    const { container } = mount(); await screen.findByText(script);
    expect(container.querySelector('script')).toBeNull();
    const body = screen.getByLabelText('返信本文') as HTMLTextAreaElement;
    fireEvent.change(body, { target: { value: '編集中の返信' } });
    fireEvent.click(screen.getByRole('button', { name: 'テスト返信を記録' }));
    await screen.findByRole('alert'); expect(body.value).toBe('編集中の返信'); expect(body.readOnly).toBe(false);
  });
  it('過去の送信を再試行しても、新しい下書きを消さない', async () => {
    const old = row('過去の返信', { status: 'uncertain', canRetry: true });
    fetchMock.mockResolvedValueOnce(Response.json({ ...empty, items: [old] }))
      .mockResolvedValueOnce(Response.json({ ...old, status: 'accepted', canRetry: false }));
    mount(); await screen.findByText('過去の返信');
    const body = screen.getByLabelText('返信本文') as HTMLTextAreaElement;
    fireEvent.change(body, { target: { value: '新しく書いている内容' } });
    fireEvent.click(screen.getByRole('button', { name: '同じ内容で再試行' }));
    await screen.findByText('送信受付済み'); expect(body.value).toBe('新しく書いている内容');
    expect(fetchMock.mock.calls[1][0]).toContain(`/${old.id}/retry`);
  });
  it('履歴取得失敗から再読込でき、未設定なら送信できない', async () => {
    fetchMock.mockRejectedValueOnce(new Error('通信エラー')).mockResolvedValueOnce(Response.json({ ...empty, settings: { ...settings, available: false, localTest: false } }));
    mount(); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '履歴を更新' }));
    await screen.findByText('メール返信の設定が完了していません。');
    expect((screen.getByRole('button', { name: 'メールを送信' }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
