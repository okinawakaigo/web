// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConsultationDetail from './ConsultationDetail';
import type { Consultation } from '@okinawa-care/contracts';

const item: Consultation = {
  id: 'a74608c1-36aa-4c08-9a99-f9d0ca8e54e9', createdAt: '2026-09-11T01:00:00Z', name: '<script>test</script>',
  email: 'test@example.invalid', role: 'その他', ageGroup: '', gender: '', availability: '', questions: '',
  source: 'instagram', medium: 'bio', status: '未対応', note: '', revision: 0, notification: 'failed',
};
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('React管理画面', () => {
  it('相談内容をテキストとして表示し、保存競合でも編集中のメモを残す', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(item))
      .mockResolvedValueOnce(Response.json({ message: '別の操作で更新されています。' }, { status: 409 }));
    vi.stubGlobal('fetch', fetch);
    const { container } = render(<ConsultationDetail id={item.id} onChange={vi.fn()} />);
    await screen.findByText(item.name);
    expect(container.querySelector('script')).toBeNull();
    const note = screen.getByLabelText('担当者メモ') as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: '編集中のメモ' } });
    fireEvent.click(screen.getByRole('button', { name: '対応状況を保存' }));
    await screen.findByText('別の操作で更新されています。');
    expect(note.value).toBe('編集中のメモ');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ revision: 0, note: '編集中のメモ' });
  });
  it('通知の再試行は未保存のメモや対応状況を上書きしない', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(item))
      .mockResolvedValueOnce(Response.json({ ...item, notification: 'sent', revision: 3, status: '対応完了', note: '別の担当者の更新' }))
      .mockResolvedValueOnce(Response.json({ message: '更新競合' }, { status: 409 }));
    vi.stubGlobal('fetch', fetch); const onChange = vi.fn();
    render(<ConsultationDetail id={item.id} onChange={onChange} />);
    await screen.findByText(item.name);
    const note = screen.getByLabelText('担当者メモ') as HTMLTextAreaElement;
    const status = screen.getByLabelText('対応状況') as HTMLSelectElement;
    fireEvent.change(note, { target: { value: 'まだ保存していません' } });
    fireEvent.change(status, { target: { value: '連絡済み' } });
    fireEvent.click(screen.getByText('受付情報・通知状況'));
    fireEvent.click(screen.getByRole('button', { name: '担当者への通知を再試行' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(note.value).toBe('まだ保存していません'); expect(status.value).toBe('連絡済み');
    expect((screen.getByRole('button', { name: '担当者への通知を再試行' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '対応状況を保存' }));
    await screen.findByText('更新競合');
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toMatchObject({ revision: 0, note: 'まだ保存していません', status: '連絡済み' });
  });
  it('取得失敗から読み直せる', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('通信エラー')).mockResolvedValueOnce(Response.json(item));
    vi.stubGlobal('fetch', fetch);
    render(<ConsultationDetail id={item.id} onChange={vi.fn()} />);
    await screen.findByText('通信エラー');
    fireEvent.click(screen.getByRole('button', { name: '保存済みの内容を読み直す' }));
    await screen.findByText(item.name);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('相談が変わったら、前の相談の入力を新しい相談に引き継がない', async () => {
    const next = { ...item, id: 'b74608c1-36aa-4c08-9a99-f9d0ca8e54e9', name: '次の相談者' };
    let finish!: (response: Response) => void;
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(item))
      .mockReturnValueOnce(new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', fetch);
    const onChange = vi.fn();
    const { rerender } = render(<ConsultationDetail id={item.id} onChange={onChange} />);
    await screen.findByText(item.name);
    fireEvent.change(screen.getByLabelText('担当者メモ'), { target: { value: '前の相談のメモ' } });
    rerender(<ConsultationDetail id={next.id} onChange={onChange} />);
    expect(screen.queryByText(item.name)).toBeNull();
    expect(screen.queryByLabelText('担当者メモ')).toBeNull();
    await act(async () => { finish(Response.json(next)); });
    expect((screen.getByLabelText('担当者メモ') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByText(next.name)).toBeTruthy();
  });

  it('再レンダー前の連続送信も一件にまとめ、保存後に編集状態を解除する', async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(item))
      .mockReturnValueOnce(new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', fetch);
    const onEditorChange = vi.fn();
    render(<ConsultationDetail id={item.id} onChange={vi.fn()} onEditorChange={onEditorChange} />);
    await screen.findByText(item.name);
    fireEvent.change(screen.getByLabelText('担当者メモ'), { target: { value: '保存するメモ' } });
    const form = screen.getByLabelText('担当者メモ').closest('form')!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(onEditorChange).toHaveBeenLastCalledWith(true, true);
    await act(async () => { finish(Response.json({ ...item, note: '保存するメモ', revision: 1 })); });
    expect(onEditorChange).toHaveBeenLastCalledWith(false, false);
    expect(screen.getByText('保存しました。')).toBeTruthy();
    expect((screen.getByRole('button', { name: '対応状況を保存' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
