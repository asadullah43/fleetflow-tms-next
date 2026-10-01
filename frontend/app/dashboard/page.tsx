'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../lib/auth-context';
import { useT, useLanguage, useLocalizedDigits, useLocalizedStatValue } from '../../lib/language-context';
import { dashboardClient, DashboardSummaryDto } from '../../lib/grpc/dashboard';
import { Icon, IconName } from '../../components/icons';
import { trucksClient, TruckDto } from '../../lib/grpc/trucks';
import { departmentsClient, employeesClient, attendanceClient, leaveRequestsClient, employmentContractsClient, EmployeeDto } from '../../lib/grpc/hr';
import { workOrdersClient, maintenanceSchedulesClient, vehicleInspectionsClient, workshopExpensesClient, sparePartsClient, WorkOrderDto, MaintenanceScheduleDto, VehicleInspectionDto } from '../../lib/grpc/workshop';

/** `module`: extra permission (beyond dashboard:view) a tab's data needs — the tab is hidden without it. */
const TABS: { key: string; label: string; icon: IconName; module?: string }[] = [
  { key: 'operations', label: 'Operations', icon: 'gauge' },
  { key: 'hr', label: 'HR Dashboard', icon: 'userCog', module: 'hr' },
  { key: 'workshop', label: 'Workshop Dashboard', icon: 'wrench', module: 'workshop' },
  { key: 'map', label: 'Map', icon: 'mapPin' },
];

function StatCard({ icon, tone, label, value }: { icon: IconName; tone: string; label: string; value: string | number }) {
  const ItemIcon = Icon[icon];
  const t = useT();
  const statValue = useLocalizedStatValue();
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className={`stat-icon stat-icon-${tone}`}>
          <ItemIcon size={18} />
        </span>
      </div>
      <div className="stat-label">{t(label)}</div>
      <div className="stat-value mono">{statValue(value)}</div>
    </div>
  );
}

function ProgressRow({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const t = useT();
  const n = useLocalizedDigits();
  return (
    <div className="progress-row">
      <span className="progress-label">{t(label)}</span>
      <span className="progress-track">
        <span className="progress-fill" style={{ width: `${pct}%`, background: `var(--tile-${tone}-fg)` }} />
      </span>
      <span className="progress-value mono">{n(value)}</span>
    </div>
  );
}

function TabBar({ tabs, active, onChange }: { tabs: typeof TABS; active: string; onChange: (key: string) => void }) {
  const t = useT();
  return (
    <div className="dash-tabs">
      {tabs.map((tab) => {
        const TabIcon = Icon[tab.icon];
        return (
          <button key={tab.key} type="button" className={`dash-tab${active === tab.key ? ' active' : ''}`} onClick={() => onChange(tab.key)}>
            <span className="dash-tab-icon">
              <TabIcon size={14} />
            </span>
            {t(tab.label)}
          </button>
        );
      })}
    </div>
  );
}

function OperationsTab({ summary }: { summary: DashboardSummaryDto | null }) {
  const t = useT();
  const n = useLocalizedDigits();
  if (!summary) {
    return <div className="empty-state" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>{t('Loading fleet summary...')}</div>;
  }

  const snapshot = [
    { label: 'Active trucks', value: summary.activeTrucks, tone: 'orange' },
    { label: 'Active drivers', value: summary.activeDrivers, tone: 'blue' },
    { label: 'Trips (MTD)', value: summary.tripsThisMonth, tone: 'teal' },
    { label: 'Open work orders', value: summary.openWorkOrders, tone: 'pink' },
  ];
  const snapshotMax = Math.max(1, ...snapshot.map((s) => s.value));

  const alerts = [
    summary.lowStockSpareParts > 0 && {
      icon: 'box' as IconName,
      tone: 'pink',
      text: `${n(summary.lowStockSpareParts)} ${t(summary.lowStockSpareParts === 1 ? 'spare part' : 'spare parts')} ${t('at or below minimum stock')}`,
    },
    summary.unpaidInvoicesCount > 0 && {
      icon: 'invoice' as IconName,
      tone: 'orange',
      text: `${n(summary.unpaidInvoicesCount)} ${t(summary.unpaidInvoicesCount === 1 ? 'unpaid invoice' : 'unpaid invoices')} ${t('totalling')} ${n(summary.unpaidInvoicesTotal)} ${t('SAR')}`,
    },
    summary.pendingLeaveRequests > 0 && {
      icon: 'calendar' as IconName,
      tone: 'purple',
      text: `${n(summary.pendingLeaveRequests)} ${t(summary.pendingLeaveRequests === 1 ? 'leave request' : 'leave requests')} ${t('awaiting approval')}`,
    },
    summary.openWorkOrders > 0 && {
      icon: 'wrench' as IconName,
      tone: 'blue',
      text: `${n(summary.openWorkOrders)} ${t(summary.openWorkOrders === 1 ? 'work order' : 'work orders')} ${t('open or in progress')}`,
    },
  ].filter(Boolean as unknown as (v: unknown) => v is { icon: IconName; tone: string; text: string });

  return (
    <>
      <div className="stat-grid">
        <StatCard icon="truck" tone="orange" label="Active trucks" value={summary.activeTrucks} />
        <StatCard icon="driver" tone="blue" label="Active drivers" value={summary.activeDrivers} />
        <StatCard icon="route" tone="teal" label="Trips this month" value={summary.tripsThisMonth} />
        <StatCard icon="wrench" tone="pink" label="Open work orders" value={summary.openWorkOrders} />
        <StatCard icon="invoice" tone="purple" label="Unpaid invoices" value={`${summary.unpaidInvoicesCount} · ${summary.unpaidInvoicesTotal} SAR`} />
        <StatCard icon="calendar" tone="green" label="Pending leave requests" value={summary.pendingLeaveRequests} />
        <StatCard icon="box" tone="orange" label="Low stock spare parts" value={summary.lowStockSpareParts} />
      </div>

      <div className="dash-grid">
        <div className="panel" style={{ padding: 22 }}>
          <h3 className="dash-panel-title">{t('This month at a glance')}</h3>
          <p className="dash-panel-sub">{t('Active fleet & operational load, side by side.')}</p>
          {snapshot.map((row) => (
            <ProgressRow key={row.label} label={row.label} value={row.value} max={snapshotMax} tone={row.tone} />
          ))}
        </div>

        <div className="panel" style={{ padding: 22 }}>
          <h3 className="dash-panel-title">{t('Needs attention')}</h3>
          <p className="dash-panel-sub">{t('Open items pulled from across the fleet.')}</p>
          {alerts.length === 0 ? (
            <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>{t('Nothing outstanding right now.')}</div>
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
  );
}

function HrDashboardTab({ token }: { token: string }) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [departmentsCount, setDepartmentsCount] = useState(0);
  const [todayPresent, setTodayPresent] = useState(0);
  const [todayAbsent, setTodayAbsent] = useState(0);
  const [todayLate, setTodayLate] = useState(0);
  const [pendingLeave, setPendingLeave] = useState(0);
  const [expiringContracts, setExpiringContracts] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      employeesClient.list(token),
      departmentsClient.list(token),
      attendanceClient.list(token),
      leaveRequestsClient.list(token),
      employmentContractsClient.list(token),
    ]).then(([emps, deps, attendance, leave, contracts]) => {
      if (cancelled) return;
      const today = new Date().toISOString().slice(0, 10);
      const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setEmployees(emps);
      setDepartmentsCount(deps.length);
      const todays = attendance.filter((a) => a.attendDate?.slice(0, 10) === today);
      setTodayPresent(todays.filter((a) => a.status === 'PRESENT').length);
      setTodayAbsent(todays.filter((a) => a.status === 'ABSENT').length);
      setTodayLate(todays.filter((a) => a.status === 'LATE' || a.status === 'HALF_DAY').length);
      setPendingLeave(leave.filter((l) => l.status === 'PENDING').length);
      setExpiringContracts(
        contracts.filter((c) => c.status === 'ACTIVE' && c.endDate && c.endDate.slice(0, 10) <= in30Days && c.endDate.slice(0, 10) >= today).length,
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return <div className="empty-state" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>{t('Loading HR summary...')}</div>;
  }

  const active = employees.filter((e) => e.employmentStatus === 'ACTIVE').length;
  const onLeave = employees.filter((e) => e.employmentStatus === 'ON_LEAVE').length;
  const terminated = employees.filter((e) => e.employmentStatus === 'TERMINATED').length;

  const byDept = new Map<string, number>();
  for (const e of employees) {
    const key = e.departmentName ?? 'Unassigned';
    byDept.set(key, (byDept.get(key) ?? 0) + 1);
  }
  const deptRows = Array.from(byDept.entries()).sort((a, b) => b[1] - a[1]);
  const deptMax = Math.max(1, ...deptRows.map(([, v]) => v));

  return (
    <>
      <div className="stat-grid">
        <StatCard icon="users" tone="blue" label="Total employees" value={employees.length} />
        <StatCard icon="userCog" tone="green" label="Active" value={active} />
        <StatCard icon="calendar" tone="orange" label="On leave" value={onLeave} />
        <StatCard icon="building" tone="purple" label="Departments" value={departmentsCount} />
        <StatCard icon="fileCheck" tone="teal" label="Present today" value={todayPresent} />
        <StatCard icon="alert" tone="pink" label="Absent / late today" value={todayAbsent + todayLate} />
        <StatCard icon="clipboard" tone="orange" label="Pending leave requests" value={pendingLeave} />
        <StatCard icon="fileText" tone="purple" label="Contracts expiring (30d)" value={expiringContracts} />
      </div>

      <div className="dash-grid">
        <div className="panel" style={{ padding: 22 }}>
          <h3 className="dash-panel-title">{t('Headcount by department')}</h3>
          <p className="dash-panel-sub">{t('Where the active roster sits today.')}</p>
          {deptRows.length === 0 ? (
            <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>{t('No employees recorded yet.')}</div>
          ) : (
            deptRows.map(([label, value]) => <ProgressRow key={label} label={label} value={value} max={deptMax} tone="blue" />)
          )}
        </div>

        <div className="panel" style={{ padding: 22 }}>
          <h3 className="dash-panel-title">{t('Workforce status')}</h3>
          <p className="dash-panel-sub">{t('Active, on leave, and terminated employees.')}</p>
          {(
            [
              { label: 'Active', value: active, tone: 'green' },
              { label: 'On leave', value: onLeave, tone: 'orange' },
              { label: 'Terminated', value: terminated, tone: 'pink' },
            ] as const
          ).map((row) => (
            <ProgressRow key={row.label} label={row.label} value={row.value} max={Math.max(1, employees.length)} tone={row.tone} />
          ))}
        </div>
      </div>
    </>
  );
}

function WorkshopDashboardTab({ token }: { token: string }) {
  const t = useT();
  const n = useLocalizedDigits();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrderDto[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceScheduleDto[]>([]);
  const [inspections, setInspections] = useState<VehicleInspectionDto[]>([]);
  const [expensesThisMonth, setExpensesThisMonth] = useState(0);
  const [lowStockParts, setLowStockParts] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([workOrdersClient.list(token), maintenanceSchedulesClient.list(token), vehicleInspectionsClient.list(token), workshopExpensesClient.list(token), sparePartsClient.list(token)]).then(
      ([wo, maint, insp, expenses, parts]) => {
        if (cancelled) return;
        setWorkOrders(wo);
        setMaintenance(maint);
        setInspections(insp);
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        setExpensesThisMonth(expenses.filter((e) => e.expenseDate?.slice(0, 7) === monthKey).reduce((sum, e) => sum + Number(e.amount || 0), 0));
        setLowStockParts(parts.filter((p) => p.quantity <= p.minimumStock).length);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return <div className="empty-state" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>{t('Loading workshop summary...')}</div>;
  }

  const today = new Date().toISOString().slice(0, 10);
  const open = workOrders.filter((w) => w.status === 'OPEN').length;
  const inProgress = workOrders.filter((w) => w.status === 'IN_PROGRESS').length;
  const completedThisMonth = workOrders.filter((w) => w.status === 'COMPLETED' && w.completionDate?.slice(0, 7) === today.slice(0, 7)).length;
  const overdueMaintenance = maintenance.filter((m) => m.status !== 'DONE' && m.nextService && m.nextService.slice(0, 10) < today).length;
  const failedInspections = inspections.filter((i) => i.result === 'FAIL').length;

  const byPriority = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((p) => ({
    label: p.charAt(0) + p.slice(1).toLowerCase(),
    value: workOrders.filter((w) => w.priority === p && w.status !== 'COMPLETED' && w.status !== 'CANCELLED').length,
  }));
  const priorityMax = Math.max(1, ...byPriority.map((r) => r.value));

  return (
    <>
      <div className="stat-grid">
        <StatCard icon="wrench" tone="orange" label="Open work orders" value={open} />
        <StatCard icon="gauge" tone="blue" label="In progress" value={inProgress} />
        <StatCard icon="fileCheck" tone="green" label="Completed this month" value={completedThisMonth} />
        <StatCard icon="alert" tone="pink" label="Overdue maintenance" value={overdueMaintenance} />
        <StatCard icon="clipboard" tone="purple" label="Failed inspections" value={failedInspections} />
        <StatCard icon="box" tone="orange" label="Low stock spare parts" value={lowStockParts} />
        <StatCard icon="invoice" tone="teal" label="Expenses this month" value={`${expensesThisMonth.toFixed(2)} SAR`} />
      </div>

      <div className="dash-grid">
        <div className="panel" style={{ padding: 22 }}>
          <h3 className="dash-panel-title">{t('Open work by priority')}</h3>
          <p className="dash-panel-sub">{t('Jobs not yet completed or cancelled.')}</p>
          {byPriority.every((r) => r.value === 0) ? (
            <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>{t('Nothing open right now.')}</div>
          ) : (
            byPriority.map((row) => <ProgressRow key={row.label} label={row.label} value={row.value} max={priorityMax} tone="orange" />)
          )}
        </div>

        <div className="panel" style={{ padding: 22 }}>
          <h3 className="dash-panel-title">{t('Needs attention')}</h3>
          <p className="dash-panel-sub">{t('Open items pulled from the workshop.')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {overdueMaintenance > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="stat-icon stat-icon-pink" style={{ width: 32, height: 32, flexShrink: 0 }}>
                  <Icon.alert size={15} />
                </span>
                <span style={{ fontSize: 13 }}>
                  {n(overdueMaintenance)} {t(overdueMaintenance === 1 ? 'maintenance schedule' : 'maintenance schedules')} {t('past due')}
                </span>
              </div>
            )}
            {lowStockParts > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="stat-icon stat-icon-orange" style={{ width: 32, height: 32, flexShrink: 0 }}>
                  <Icon.box size={15} />
                </span>
                <span style={{ fontSize: 13 }}>
                  {n(lowStockParts)} {t(lowStockParts === 1 ? 'spare part' : 'spare parts')} {t('at or below minimum stock')}
                </span>
              </div>
            )}
            {failedInspections > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="stat-icon stat-icon-purple" style={{ width: 32, height: 32, flexShrink: 0 }}>
                  <Icon.clipboard size={15} />
                </span>
                <span style={{ fontSize: 13 }}>
                  {n(failedInspections)} {t(failedInspections === 1 ? 'failed inspection' : 'failed inspections')} {t('on record')}
                </span>
              </div>
            )}
            {overdueMaintenance === 0 && lowStockParts === 0 && failedInspections === 0 && (
              <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>{t('Nothing outstanding right now.')}</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function MapTab({ token }: { token: string }) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [trucks, setTrucks] = useState<TruckDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    trucksClient.list(token).then((list) => {
      if (cancelled) return;
      setTrucks(list);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return <div className="empty-state" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>{t('Loading fleet...')}</div>;
  }

  const active = trucks.filter((t) => t.status === 'ACTIVE').length;

  return (
    <>
      <div className="stat-grid">
        <StatCard icon="truck" tone="orange" label="Fleet size" value={trucks.length} />
        <StatCard icon="gauge" tone="green" label="Active trucks" value={active} />
        <StatCard icon="mapPin" tone="blue" label="Live positions" value="—" />
      </div>

      <div className="dash-grid">
        <div className="panel" style={{ padding: 22 }}>
          <div className="dash-map-placeholder">
            <span className="stat-icon stat-icon-blue">
              <Icon.mapPin size={24} />
            </span>
            <h3 className="dash-panel-title" style={{ margin: 0 }}>
              {t('Live tracker not connected yet')}
            </h3>
            <p className="dash-panel-sub" style={{ margin: 0, maxWidth: 360 }}>
              {t(
                'This is where the real-time GPS positions of your trucks will show up once a tracking provider is wired in — pins moving on the map, trip routes, and geofence alerts.',
              )}
            </p>
          </div>
        </div>

        <div className="panel" style={{ padding: 22 }}>
          <h3 className="dash-panel-title">{t('Fleet roster')}</h3>
          <p className="dash-panel-sub">{t('Trucks that will appear on the map once tracking is connected.')}</p>
          {trucks.length === 0 ? (
            <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>{t('No trucks recorded yet.')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
              {trucks.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span className="stat-icon stat-icon-orange" style={{ width: 28, height: 28, flexShrink: 0 }}>
                      <Icon.truck size={13} />
                    </span>
                    <span className="mono">{t.truckNumber}</span>
                    {t.truckType && <span style={{ color: 'var(--text-faint)' }}>{t.truckType}</span>}
                  </span>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { user, token, can } = useAuth();
  const tabs = TABS.filter((tab) => !tab.module || can(tab.module, 'view'));
  const { language } = useLanguage();
  const t = useT();
  const [tab, setTab] = useState('operations');
  const [summary, setSummary] = useState<DashboardSummaryDto | null>(null);

  useEffect(() => {
    if (!token) return;
    dashboardClient.getSummary(token).then(setSummary).catch(() => setSummary(null));
  }, [token]);

  return (
    <AppShell title="Dashboard">
      <div className="panel dash-welcome">
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>
            {t('Welcome back,')} {user?.name}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
            {t('Role:')} {user?.role ? t(user.role) : t('None')} &nbsp;&nbsp; {t('Language:')} {language === 'ar' ? 'العربية' : 'English'}
          </div>
        </div>
        <span className="topbar-avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
          {(user?.name ?? '?').slice(0, 1).toUpperCase()}
        </span>
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'operations' && <OperationsTab summary={summary} />}
      {tab === 'hr' && token && <HrDashboardTab token={token} />}
      {tab === 'workshop' && token && <WorkshopDashboardTab token={token} />}
      {tab === 'map' && token && <MapTab token={token} />}
    </AppShell>
  );
}
