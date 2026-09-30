'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NAV_GROUPS } from '../lib/nav-config';
import { useAuth } from '../lib/auth-context';

/**
 * Shared shell for every authenticated page: sidebar nav, topbar, and the
 * auth guard (redirects to /login if there's no session) — every module
 * page wraps its content in this instead of repeating that logic.
 */
export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  function onSignOut() {
    logout();
    router.push('/login');
  }

  if (loading || !user) {
    return <div className="centered-screen">Loading...</div>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          Fleet<span>Flow</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="sidebar-group">{group.label}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link${pathname.startsWith(item.href) ? ' active' : ''}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <h1>{title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{user?.name}</span>
            <button className="btn btn-secondary" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
