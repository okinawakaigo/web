// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Consultation, ConsultationList } from '@okinawa-care/contracts';
import App from './App';

const item: Consultation = { id: 'a74608c1-36aa-4c08-9a99-f9d0ca8e54e9', createdAt: '2026-09-11T01:00:00Z', name: '確認用の相談', email: 'test@example.invalid', role: 'その他', ageGroup: '', gender: '', availability: '', questions: '', source: 'direct', medium: 'none', status: '未対応', note: '', revision: 0, notification: 'unconfigured' };
const listing: ConsultationList = { items: [item], total: 82, hasMore: true, counts: { 未対応: 22, 連絡済み: 30, 日程確定: 20, 対応完了: 10 } };
const fetchMock = vi.fn();
beforeEach(() => {
  history.replaceState(null, '', '/#overview');
  fetchMock.mockReset().mockImplementation(async (path: string) => Response.json(path.endsWith('/replies')
    ? { items: [], nextCursor: null, settings: { available: true, localTest: true, from: 'local@example.invalid', replyTo: 'local@example.invalid' } }
    : path.includes(item.id) ? item : listing));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false; });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('ダッシュボードの業務導線', () => {
  it('返信の下書きも、閉じる操作と再読み込みから保護する', async () => {
    history.replaceState(null, '', '/#' + item.id);
    render(<App />); await screen.findByText('ローカル確認用です。返信を記録しますが、メールは送信しません。');
    fireEvent.change(screen.getByLabelText('返信本文'), { target: { value: 'まだ送信していない返信' } });
    const confirm = vi.fn().mockReturnValue(false); vi.stubGlobal('confirm', confirm);
    fireEvent.click(screen.getByRole('button', { name: '詳細を閉じる' }));
    expect(confirm).toHaveBeenCalledOnce(); expect(screen.getByRole('dialog')).toBeTruthy();
    const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });
  it('全件の状態別集計から未対応の一覧へ移動できる', async () => {
    render(<App />);
    await screen.findByText('累計 82件');
    fireEvent.click(screen.getByRole('link', { name: /未対応をすべて見る/ }));
    await waitFor(() => expect(fetchMock.mock.lastCall?.[0]).toContain('status=' + encodeURIComponent('未対応')));
    expect(screen.getByRole('heading', { name: '参加相談', level: 1 })).toBeTruthy();
    expect(screen.getByRole('button', { name: /未対応.*22/ }).getAttribute('aria-pressed')).toBe('true');
  });
  it('名前・仕事の検索は表示ページだけに限定せず、ページを先頭へ戻す', async () => {
    history.replaceState(null, '', '/#consultations?offset=50');
    render(<App />); await screen.findByText('確認用の相談');
    fireEvent.change(screen.getByLabelText('お名前・仕事で検索'), { target: { value: '沖縄' } });
    fireEvent.click(screen.getByRole('button', { name: '検索' }));
    await waitFor(() => expect(fetchMock.mock.lastCall?.[0]).toContain('q=' + encodeURIComponent('沖縄')));
    expect(fetchMock.mock.lastCall?.[0]).toContain('offset=0');
    expect(location.hash).not.toContain('offset=50');
  });
  it('旧メールの詳細リンクを開けて、閉じる操作や再読み込みで未保存のメモを保護する', async () => {
    history.replaceState(null, '', '/#' + item.id);
    render(<App />); await screen.findByRole('heading', { name: item.name });
    const note = screen.getByLabelText('担当者メモ') as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: '日程を確認中' } });
    const confirm = vi.fn().mockReturnValue(false); vi.stubGlobal('confirm', confirm);
    fireEvent.click(screen.getByRole('button', { name: '詳細を閉じる' }));
    expect(confirm).toHaveBeenCalledOnce(); expect(note.value).toBe('日程を確認中');
    expect(screen.getByRole('dialog')).toBeTruthy();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload); expect(unload.defaultPrevented).toBe(true);
    confirm.mockReturnValue(true); fireEvent.click(screen.getByRole('button', { name: '詳細を閉じる' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(location.hash).toBe('#consultations');
  });
  it('メニューから採用へ移動でき、空の結果に次の操作を示す', async () => {
    fetchMock.mockImplementation(async () => Response.json({ items: [], total: 0, hasMore: false, counts: { 未対応: 0, 連絡済み: 0, 日程確定: 0, 対応完了: 0 } }));
    render(<App />); await screen.findByText('参加相談はまだ届いていません');
    fireEvent.click(screen.getByRole('button', { name: 'メニューを開く' }));
    expect(screen.getByRole('dialog', { name: 'メインメニュー' })).toBeTruthy();
    // The desktop copy exists in this DOM test; the real CSS hides it on mobile.
    fireEvent.click(screen.getAllByRole('link', { name: '参加相談' }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(location.hash).toBe('#consultations');
  });
});
