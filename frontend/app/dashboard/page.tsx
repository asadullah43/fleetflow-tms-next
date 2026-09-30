'use client';

import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../lib/auth-context';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <AppShell title="Dashboard">
      <div className="panel" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Welcome back, {user?.name}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
          Role: {user?.role ?? 'None'} &nbsp;&nbsp; Language: {user?.language}
        </div>
      </div>
      <div className="empty-state" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
        Fleet summary stats land here once the Dashboard module is ported.
      </div>
    </AppShell>
  );
}
