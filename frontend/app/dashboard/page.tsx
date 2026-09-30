'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../lib/auth-context';
import { dashboardClient, DashboardSummaryDto } from '../../lib/grpc/dashboard';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value mono">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, token } = useAuth();
  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null);

  useEffect(() => {
    if (!token) return;
    dashboardClient.getSummary(token).then(setSummary).catch(() => setSummary(null));
  }, [token]);

  return (
    <AppShell title="Dashboard">
      <div className="panel" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Welcome back, {user?.name}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
          Role: {user?.role ?? 'None'} &nbsp;&nbsp; Language: {user?.language}
        </div>
      </div>

      {!summary ? (
        <div className="empty-state" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
          Loading fleet summary...
        </div>
      ) : (
        <div className="stat-grid">
          <StatCard label="Active trucks" value={summary.activeTrucks} />
          <StatCard label="Active drivers" value={summary.activeDrivers} />
          <StatCard label="Trips this month" value={summary.tripsThisMonth} />
          <StatCard label="Open work orders" value={summary.openWorkOrders} />
          <StatCard label="Unpaid invoices" value={`${summary.unpaidInvoicesCount} · ${summary.unpaidInvoicesTotal} SAR`} />
          <StatCard label="Pending leave requests" value={summary.pendingLeaveRequests} />
          <StatCard label="Low stock spare parts" value={summary.lowStockSpareParts} />
        </div>
      )}
    </AppShell>
  );
}
