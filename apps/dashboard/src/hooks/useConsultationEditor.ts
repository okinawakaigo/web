import { useEffect, useReducer, useRef } from 'react';
import type { Consultation } from '@okinawa-care/contracts';
import { api, errorMessage, notificationLabels } from '../api';

type Draft = Pick<Consultation, 'status' | 'note'>;
interface EditorState {
  item: Consultation | null;
  draft: Draft;
  phase: 'loading' | 'idle' | 'saving' | 'notifying';
  error: string;
  feedback: string;
  version: number;
}
type Action =
  | { type: 'saving' | 'notifying' }
  | { type: 'loaded' | 'saved'; item: Consultation }
  | { type: 'edited'; changes: Partial<Draft> }
  | { type: 'notified'; notification: Consultation['notification'] }
  | { type: 'failed'; message: string }
  | { type: 'reload' };

function reduceEditor(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'saving':
    case 'notifying':
      return { ...state, phase: action.type, error: '', feedback: '' };
    case 'loaded':
    case 'saved':
      return {
        ...state, item: action.item, draft: { status: action.item.status, note: action.item.note },
        phase: 'idle', error: '', feedback: action.type === 'saved' ? '保存しました。' : '',
      };
    case 'edited': return { ...state, draft: { ...state.draft, ...action.changes }, feedback: '' };
    case 'notified':
      // A notification response must not replace the draft or its original revision.
      return {
        ...state, item: state.item && { ...state.item, notification: action.notification },
        phase: 'idle', feedback: notificationLabels[action.notification],
      };
    case 'failed': return { ...state, phase: 'idle', error: action.message };
    case 'reload': return { ...state, phase: 'loading', error: '', feedback: '', version: state.version + 1 };
  }
}

export function useConsultationEditor(id: string, onChange: () => void, onEditorChange?: (dirty: boolean, busy: boolean) => void) {
  const [state, dispatch] = useReducer(reduceEditor, {
    item: null, draft: { status: '未対応', note: '' }, phase: 'loading', error: '', feedback: '', version: 0,
  });
  // A synchronous lock also blocks duplicate calls before React renders the busy state.
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => { mutation.current?.abort(); mutation.current = null; }, [id]);
  useEffect(() => {
    const controller = new AbortController();
    void api<Consultation>(`/api/consultations/${id}`, { signal: controller.signal })
      .then(item => {
        if (controller.signal.aborted) return;
        dispatch({ type: 'loaded', item });
        onEditorChange?.(false, false);
      })
      .catch(problem => { if (!controller.signal.aborted) dispatch({ type: 'failed', message: errorMessage(problem) }); });
    return () => controller.abort();
  }, [id, state.version, onEditorChange]);

  const dirty = !!state.item && (state.draft.status !== state.item.status || state.draft.note !== state.item.note);
  const busy = state.phase === 'saving' || state.phase === 'notifying';
  function edit(changes: Partial<Draft>) {
    const draft = { ...state.draft, ...changes };
    dispatch({ type: 'edited', changes });
    // Notify the parent in the same event, without a second render through an Effect.
    onEditorChange?.(!!state.item && (draft.status !== state.item.status || draft.note !== state.item.note), busy);
  }

  async function mutate(operation: 'saving' | 'notifying') {
    if (!state.item || state.phase === 'loading' || mutation.current) return;
    const controller = new AbortController();
    mutation.current = controller;
    dispatch({ type: operation });
    onEditorChange?.(dirty, true);
    try {
      const saving = operation === 'saving';
      const item = await api<Consultation>(`/api/consultations/${id}${saving ? '' : '/notify'}`, {
        method: saving ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify(saving ? { ...state.draft, revision: state.item.revision } : {}),
      });
      if (controller.signal.aborted) return;
      dispatch(saving ? { type: 'saved', item } : { type: 'notified', notification: item.notification });
      onEditorChange?.(saving ? false : dirty, false);
      onChange();
    } catch (problem) {
      if (!controller.signal.aborted) {
        dispatch({ type: 'failed', message: errorMessage(problem) });
        onEditorChange?.(dirty, false);
      }
    } finally {
      if (mutation.current === controller) mutation.current = null;
    }
  }

  return {
    ...state, ...state.draft, dirty, busy, loading: state.phase === 'loading',
    edit,
    reload: () => { if (!mutation.current) dispatch({ type: 'reload' }); },
    save: () => mutate('saving'), retryNotification: () => mutate('notifying'),
  };
}
