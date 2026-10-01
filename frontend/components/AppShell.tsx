'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NAV_GROUPS } from '../lib/nav-config';
import { useAuth } from '../lib/auth-context';
import { Icon } from './icons';

/**
 * Shared shell for every authenticated page: sidebar nav, topbar, and the
 * auth guard (redirects to /login if there's no session) — every module
 * page wraps its content in this instead of repeating that logic.
 */
export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  // Groups are collapsible; the group containing the current page starts
  // open, every other group starts closed. Toggling is independent per
  // group so more than one can be open at once.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of NAV_GROUPS) {
      initial[group.label] = group.items.some((item) => pathname.startsWith(item.href));
    }
    return initial;
  });

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

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
          <span className="sidebar-brand-mark">
            <Icon.truck size={16} />
          </span>
          Fleet<span>Flow</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => {
            const GroupIcon = Icon[group.icon];
            const isOpen = openGroups[group.label] ?? false;
            return (
              <div key={group.label}>
                <button
                  type="button"
                  className="sidebar-group-header"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={isOpen}
                >
                  <GroupIcon size={16} />
                  <span>{group.label}</span>
                  <Icon.chevronDown size={14} />
                </button>
                {isOpen && (
                  <div className="sidebar-group-items">
                    {group.items.map((item) => {
                      const ItemIcon = Icon[item.icon];
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`sidebar-link${pathname.startsWith(item.href) ? ' active' : ''}`}
                        >
                          <ItemIcon size={16} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <h1>{title}</h1>
          <div className="topbar-user">
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{user?.name}</span>
            <span className="topbar-avatar">{(user?.name ?? '?').slice(0, 1).toUpperCase()}</span>
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
