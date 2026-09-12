import { useCallback, useEffect, useReducer } from 'react';
import type { ConsultationList, Status } from '@okinawa-care/contracts';
import { api, errorMessage } from '../api';

interface ListState {
  listing: ConsultationList | null;
  updatedAt: Date | null;
  request: { phase: 'loading' | 'ready' } | { phase: 'error'; message: string };
  resultKey: string;
  version: number;
}
type Action =
  | { type: 'loaded'; listing: ConsultationList; updatedAt: Date; key: string }
  | { type: 'failed'; message: string; key: string }
  | { type: 'reload' };

function reduceList(state: ListState, action: Action): ListState {
  switch (action.type) {
    case 'loaded': return { ...state, listing: action.listing, updatedAt: action.updatedAt, resultKey: action.key, request: { phase: 'ready' } };
    case 'failed': return { ...state, resultKey: action.key, request: { phase: 'error', message: action.message } };
    case 'reload': return { ...state, request: { phase: 'loading' }, version: state.version + 1 };
  }
}

export function useConsultationList(filter: Status | '', offset: number, query: string) {
  const [state, dispatch] = useReducer(reduceList, {
    listing: null, updatedAt: null, request: { phase: 'loading' }, resultKey: '', version: 0,
  });
  const key = new URLSearchParams({ status: filter, offset: String(offset), q: query }).toString();
  const reload = useCallback(() => dispatch({ type: 'reload' }), []);
  useEffect(() => {
    const controller = new AbortController();
    void api<ConsultationList>(`/api/consultations?${key}`, { signal: controller.signal })
      .then(listing => {
        if (!controller.signal.aborted) dispatch({ type: 'loaded', listing, updatedAt: new Date(), key });
      })
      .catch(problem => {
        if (!controller.signal.aborted) dispatch({ type: 'failed', message: errorMessage(problem), key });
      });
    return () => controller.abort();
  }, [key, state.version]);

  return {
    listing: state.listing, updatedAt: state.updatedAt, reload,
    loading: state.resultKey !== key || state.request.phase === 'loading',
    error: state.resultKey === key && state.request.phase === 'error' ? state.request.message : '',
  };
}
