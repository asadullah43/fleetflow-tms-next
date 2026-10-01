'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../lib/auth-context';
import { dashboardClient, DashboardSummaryDto } from '../../lib/grpc/dashboard';
import { Icon, IconName } from '../../components/icons';

function StatCard({ icon, tone, label, value }: { icon: IconName; tone: string; label: string; value: string | number }) {
  const ItemIcon = Icon[icon];
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className={`stat-icon stat-icon-${tone}`}>
          <ItemIcon size={18} />
        </span>
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value mono">{value}</div>
    </div>
  );
}

function ProgressRow({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="progress-row">
      <span className="progress-label">{label}</span>
      <span className="progress-track">
        <span
          className="progress-fill"
          style={{ width: `${pct}%`, background: `var(--tile-${tone}-fg)` }}
        />
      </span>
      <span className="progress-value mono">{value}</span>
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

  const snapshot = summary
    ? [
        { label: 'Active trucks', value: summary.activeTrucks, tone: 'orange' },
        { label: 'Active drivers', value: summary.activeDrivers, tone: 'blue' },
        { label: 'Trips (MTD)', value: summary.tripsThisMonth, tone: 'teal' },
        { label: 'Open work orders', value: summary.openWorkOrders, tone: 'pink' },
      ]
    : [];
  const snapshotMax = Math.max(1, ...snapshot.map((s) => s.value));

  const alerts = summary
    ? [
        summary.lowStockSpareParts > 0 && {
          icon: 'box' as IconName,
          tone: 'pink',
          text: `${summary.lowStockSpareParts} spare part${summary.lowStockSpareParts === 1 ? '' : 's'} at or below minimum stock`,
        },
        summary.unpaidInvoicesCount > 0 && {
          icon: 'invoice' as IconName,
          tone: 'orange',
          text: `${summary.unpaidInvoicesCount} unpaid invoice${summary.unpaidInvoicesCount === 1 ? '' : 's'} totalling ${summary.unpaidInvoicesTotal} SAR`,
        },
        summary.pendingLeaveRequests > 0 && {
          icon: 'calendar' as IconName,
          tone: 'purple',
          text: `${summary.pendingLeaveRequests} leave request${summary.pendingLeaveRequests === 1 ? '' : 's'} awaiting approval`,
        },
        summary.openWorkOrders > 0 && {
          icon: 'wrench' as IconName,
          tone: 'blue',
          text: `${summary.openWorkOrders} work order${summary.openWorkOrders === 1 ? '' : 's'} open or in progress`,
        },
      ].filter(Boolean as unknown as (v: unknown) => v is { icon: IconName; tone: string; text: string })
    : [];

  return (
    <AppShell title="Dashboard">
      <div className="panel dash-welcome">
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Welcome back, {user?.name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
            Role: {user?.role ?? 'None'} &nbsp;&nbsp; Language: {user?.language}
          </div>
        </div>
        <span className="topbar-avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
          {(user?.name ?? '?').slice(0, 1).toUpperCase()}
        </span>
      </div>

      {!summary ? (
        <div className="empty-state" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
          Loading fleet summary...
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard icon="truck" tone="orange" label="Active trucks" value={summary.activeTrucks} />
            <StatCard icon="driver" tone="blue" label="Active drivers" value={summary.activeDrivers} />
            <StatCard icon="route" tone="teal" label="Trips this month" value={summary.tripsThisMonth} />
            <StatCard icon="wrench" tone="pink" label="Open work orders" value={summary.openWorkOrders} />
            <StatCard
              icon="invoice"
              tone="purple"
              label="Unpaid invoices"
              value={`${summary.unpaidInvoicesCount} · ${summary.unpaidInvoicesTotal} SAR`}
            />
            <StatCard icon="calendar" tone="green" label="Pending leave requests" value={summary.pendingLeaveRequests} />
            <StatCard icon="box" tone="orange" label="Low stock spare parts" value={summary.lowStockSpareParts} />
          </div>

          <div className="dash-grid">
            <div className="panel" style={{ padding: 22 }}>
              <h3 className="dash-panel-title">This month at a glance</h3>
              <p className="dash-panel-sub">Active fleet &amp; operational load, side by side.</p>
              {snapshot.map((row) => (
                <ProgressRow key={row.label} label={row.label} value={row.value} max={snapshotMax} tone={row.tone} />
              ))}
            </div>

            <div className="panel" style={{ padding: 22 }}>
              <h3 className="dash-panel-title">Needs attention</h3>
              <p className="dash-panel-sub">Open items pulled from across the fleet.</p>
              {alerts.length === 0 ? (
                <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>Nothing outstanding right now.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {alerts.map((a, i) => {
                    const AlertIcon = Icon[a.icon];
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className={`stat-icon stat-icon-${a.tone}`} style={{ width: 32, height: 32, flexShrink: 0 }}>
                          <AlertIcon size={15} />
                        </span>
                        <span style={{ fontSize: 13 }}>{a.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
