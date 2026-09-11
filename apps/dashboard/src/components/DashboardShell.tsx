import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import Icon from './Icon';
import type { DashboardRoute } from '../navigation';

export type Navigate = (href: string, event?: MouseEvent<HTMLAnchorElement>) => void;
export default function DashboardShell({ route, pending, navigate, children }: {
  route: DashboardRoute; pending?: number; navigate: Navigate; children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const recruitUrl = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)
    ? import.meta.env.VITE_RECRUIT_URL || 'http://127.0.0.1:8787/' : 'https://recruit.okinawakaigo.com/';
  const menu = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const dialog = menu.current!; dialog.showModal();
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previous; };
  }, [menuOpen]);
  const navLink: Navigate = (href, event) => { navigate(href, event); setMenuOpen(false); };
  const navigation = <>
    <a href="#overview" className="workspace-brand" onClick={event => navLink('#overview', event)} aria-label="沖縄介護センター ダッシュボードの概要">
      <span><strong>沖縄介護センター</strong><small>ダッシュボード</small></span>
    </a>
    <nav className="workspace-nav" aria-label="メインナビゲーション">
      <a href="#overview" className="nav-item" aria-current={route.page === 'overview' ? 'page' : undefined} onClick={event => navLink('#overview', event)}><Icon name="overview" /><span>概要</span></a>
      <p className="nav-group">採用</p>
      <a href="#consultations" className="nav-item" aria-current={route.page === 'consultations' ? 'page' : undefined} onClick={event => navLink('#consultations', event)}><Icon name="inbox" /><span>参加相談</span>{pending !== undefined && pending > 0 && <span className="nav-count" aria-label={`未対応 ${pending}件`}>{pending}</span>}</a>
    </nav>
    <div className="sidebar-bottom">
      <a href={recruitUrl} target="_blank" rel="noreferrer" className="sidebar-external">採用サイトを開く<Icon name="external" width="16" height="16" /><span className="sr-only">（新しいタブ）</span></a>
    </div>
  </>;
  return <div className="dashboard-shell">
    <a href="#main-content" className="skip-link" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>本文へ移動</a>
    <aside className="dashboard-sidebar">{navigation}</aside>
    <div className="dashboard-workspace">
      <header className="mobile-bar">
        <button className="icon-button" aria-label="メニューを開く" aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(true)}><Icon name="menu" /></button>
        <strong>沖縄介護センター</strong>
      </header>
      <main id="main-content" className="dashboard-main" tabIndex={-1}>{children}</main>
    </div>
    {menuOpen && <dialog id="mobile-navigation" className="mobile-navigation" ref={menu} aria-label="メインメニュー" onCancel={event => { event.preventDefault(); setMenuOpen(false); }} onClick={event => { if (event.target === event.currentTarget) setMenuOpen(false); }}>
      <div className="mobile-navigation-inner"><button className="icon-button menu-close" aria-label="メニューを閉じる" onClick={() => setMenuOpen(false)}><Icon name="close" /></button>{navigation}</div>
    </dialog>}
  </div>;
}
