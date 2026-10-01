'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NAV_GROUPS, NavGroup } from '../lib/nav-config';
import { useAuth, usePagePermissions } from '../lib/auth-context';
import { moduleForPath } from '../lib/permissions';
import { useCompanyBranding } from '../lib/use-company-branding';
import { useT } from '../lib/language-context';
import { Icon } from './icons';
import { LanguageSwitcher } from './LanguageSwitcher';

/**
 * Shared shell for every authenticated page: sidebar nav, topbar, and the
 * auth guard (redirects to /login if there's no session) — every module
 * page wraps its content in this instead of repeating that logic.
 */
export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout, can } = useAuth();
  const page = usePagePermissions();
  const { companyName, logoUrl } = useCompanyBranding();
  const t = useT();
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
    return <div className="centered-screen">{t('Loading...')}</div>;
  }

  // Only the pages this user's role can view; groups left empty disappear.
  const visibleGroups: NavGroup[] = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const module = moduleForPath(item.href);
      return !module || can(module, 'view');
    }),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          {logoUrl ? (
            <span className="sidebar-brand-mark sidebar-brand-mark-logo">
              <img src={logoUrl} alt={companyName} />
            </span>
          ) : (
            <span className="sidebar-brand-mark">
              <Icon.truck size={16} />
            </span>
          )}
          <span className="sidebar-brand-name">{companyName}</span>
        </div>
        <nav className="sidebar-nav">
          {visibleGroups.map((group) => {
            const GroupIcon = Icon[group.icon];
            const isOpen = openGroups[group.label] ?? false;

            if (group.standalone) {
              const item = group.items[0];
              const ItemIcon = Icon[item.icon];
              return (
                <Link
                  key={group.label}
                  href={item.href}
                  className={`sidebar-link-top${pathname.startsWith(item.href) ? ' active' : ''}`}
                >
                  <ItemIcon size={16} />
                  <span>{t(item.label)}</span>
                </Link>
              );
            }

            return (
              <div key={group.label}>
                <button
                  type="button"
                  className="sidebar-group-header"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={isOpen}
                >
                  <GroupIcon size={16} />
                  <span>{t(group.label)}</span>
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
                          {t(item.label)}
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
          <h1>{t(title)}</h1>
          <div className="topbar-user">
            <LanguageSwitcher />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{user?.name}</span>
            <span className="topbar-avatar">{(user?.name ?? '?').slice(0, 1).toUpperCase()}</span>
            <button className="btn btn-secondary" onClick={onSignOut}>
              {t('Sign out')}
            </button>
          </div>
        </header>
        <main className="content">
          {page.view ? children : <div className="empty-state">{t("You don't have permission to view this page.")}</div>}
        </main>
      </div>
    </div>
  );
}
