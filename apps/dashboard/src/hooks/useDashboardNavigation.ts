import { useCallback, useEffect, useReducer } from 'react';
import { readRoute, routeHref, type DashboardRoute } from '../navigation';
import type { Navigate } from '../components/DashboardShell';

interface NavigationState {
  route: DashboardRoute;
  editor: { dirty: boolean; busy: boolean };
}
type Action =
  | { type: 'navigated'; route: DashboardRoute }
  | { type: 'editorChanged'; dirty: boolean; busy: boolean };

function reduceNavigation(state: NavigationState, action: Action): NavigationState {
  if (action.type === 'navigated') return { route: action.route, editor: { dirty: false, busy: false } };
  if (state.editor.dirty === action.dirty && state.editor.busy === action.busy) return state;
  return { ...state, editor: { dirty: action.dirty, busy: action.busy } };
}

export function useDashboardNavigation() {
  const [{ route, editor }, dispatch] = useReducer(reduceNavigation, undefined, () => ({
    route: readRoute(), editor: { dirty: false, busy: false },
  }));
  const editorChanged = useCallback((dirty: boolean, busy: boolean) => {
    dispatch({ type: 'editorChanged', dirty, busy });
  }, []);
  const mayLeave = useCallback(() => !editor.busy && (!editor.dirty
    || window.confirm('保存していない変更があります。変更を破棄して移動しますか？')), [editor]);
  const navigate: Navigate = useCallback((href, event) => {
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)) return;
    event?.preventDefault();
    if (href === routeHref(route) || !mayLeave()) return;
    const next = readRoute(href);
    history.pushState(null, '', routeHref(next));
    dispatch({ type: 'navigated', route: next });
  }, [route, mayLeave]);

  useEffect(() => {
    const change = () => {
      if (!mayLeave()) { history.replaceState(null, '', routeHref(route)); return; }
      dispatch({ type: 'navigated', route: readRoute() });
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (editor.dirty || editor.busy) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('hashchange', change);
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('hashchange', change);
      window.removeEventListener('beforeunload', unload);
    };
  }, [route, editor, mayLeave]);

  return { route, navigate, editorChanged };
}
