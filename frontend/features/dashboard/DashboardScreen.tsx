'use client';

import { Avatar, Box, Group, Paper, SimpleGrid, Stack, Tabs, Text, ThemeIcon, Title } from '@mantine/core';
import { AppShell } from '../../components/AppShell';
import { DataTable } from '../../components/DataTable';
import { DonutChart, DonutSlice } from '../../components/DonutChart';
import { Icon } from '../../components/icons';
import { Mono } from '../../components/Mono';
import { StatusBadge, statusLabel } from '../../components/StatusBadge';
import type { DashboardSummaryDto, FleetSummaryDto, HrSummaryDto, WorkshopSummaryDto } from '../../lib/api/dashboard.api';
import type { TruckDto } from '../../lib/api/trucks.api';
import { monthStart, today } from '../../lib/date';
import { useLanguage, useLocalizedDigits, useT } from '../../lib/language-context';
import { localizedJoinedName } from '../../lib/localized-name';
import { AttentionItem, BarRow, FleetAvailability, Panel, Quiet, StatCard, SummaryState } from './dashboard-widgets';
import { DrillDown, useDrillDown } from './drill-down';
import { DashboardTab, useDashboardViewModel } from './use-dashboard-view-model';

const STAT_COLS = { base: 1, xs: 2, md: 3, xl: 4 };
const PANEL_COLS = { base: 1, lg: 2 };

/** Ordinal light-to-dark ramp of the brand hue: urgency reads as depth. Validated for adjacent-step separation. */
const PRIORITY_COLOR: Record<string, string> = { LOW: '#fdd2b5', MEDIUM: '#f1854a', HIGH: '#b04a1d', URGENT: '#5e2410' };
const PRIORITY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
/** Employment state: active (good), on leave (attention), terminated (neutral, out of the workforce). */
const WORKFORCE_COLOR = { ACTIVE: '#0ca678', ON_LEAVE: '#e67700', TERMINATED: '#868e96' };

const to = (href: string, filters?: Record<string, string>): DrillDown => ({ href, filters });

/** Turns label/count rows into donut slices that drill into a list. */
function useSlices() {
  const drill = useDrillDown();
  return (rows: { key: string; label: string; value: number; color: string; to: DrillDown }[]): DonutSlice[] =>
    rows.map(({ to: target, ...row }) => {
      const resolved = drill(target);
      return { ...row, href: resolved?.href, onNavigate: resolved?.onNavigate, hint: resolved?.hint };
    });
}

function OperationsTab({ summary, fleet }: { summary: DashboardSummaryDto; fleet: FleetSummaryDto | undefined }) {
  const t = useT();
  const n = useLocalizedDigits();
  const nothing = summary.lowStockSpareParts + summary.unpaidInvoicesCount + summary.pendingLeaveRequests + summary.openWorkOrders === 0;

  return (
    <Stack gap="md">
      <SimpleGrid cols={STAT_COLS} spacing="md">
        <StatCard icon="truck" color="orange" label="Active trucks" value={summary.activeTrucks} to={to('/trucks', { status: 'ACTIVE' })} />
        <StatCard icon="driver" color="blue" label="Active drivers" value={summary.activeDrivers} to={to('/drivers', { status: 'ACTIVE' })} />
        <StatCard icon="route" color="teal" label="Trips this month" value={summary.tripsThisMonth} to={to('/trips', { fromDate: monthStart() })} />
        <StatCard icon="wrench" color="pink" label="Open work orders" value={summary.openWorkOrders} to={to('/workshop/work-orders')} />
        <StatCard icon="invoice" color="grape" label="Unpaid invoices" value={`${summary.unpaidInvoicesCount} · ${summary.unpaidInvoicesTotal} SAR`} to={to('/invoices', { status: 'UNPAID' })} />
        <StatCard icon="calendar" color="green" label="Pending leave requests" value={summary.pendingLeaveRequests} to={to('/hr/leave-requests', { status: 'PENDING' })} />
        <StatCard icon="box" color="orange" label="Low stock spare parts" value={summary.lowStockSpareParts} to={to('/inventory')} />
      </SimpleGrid>
      <SimpleGrid cols={PANEL_COLS} spacing="md">
        <Panel title="Fleet availability" subtitle="Share of the fleet that is active and able to run trips.">
          {fleet ? <FleetAvailability active={fleet.activeTrucks} fleetSize={fleet.fleetSize} /> : <Quiet>{t('Loading...')}</Quiet>}
        </Panel>
        <Panel title="Needs attention" subtitle="Open items pulled from across the fleet.">
          {summary.lowStockSpareParts > 0 && (
            <AttentionItem icon="box" color="pink" to={to('/inventory')}>
              {n(summary.lowStockSpareParts)} {t(summary.lowStockSpareParts === 1 ? 'spare part' : 'spare parts')} {t('at or below minimum stock')}
            </AttentionItem>
          )}
          {summary.unpaidInvoicesCount > 0 && (
            <AttentionItem icon="invoice" color="orange" to={to('/invoices', { status: 'UNPAID' })}>
              {n(summary.unpaidInvoicesCount)} {t(summary.unpaidInvoicesCount === 1 ? 'unpaid invoice' : 'unpaid invoices')} {t('totalling')} {n(summary.unpaidInvoicesTotal)} {t('SAR')}
            </AttentionItem>
          )}
          {summary.pendingLeaveRequests > 0 && (
            <AttentionItem icon="calendar" color="grape" to={to('/hr/leave-requests', { status: 'PENDING' })}>
              {n(summary.pendingLeaveRequests)} {t(summary.pendingLeaveRequests === 1 ? 'leave request' : 'leave requests')} {t('awaiting approval')}
            </AttentionItem>
          )}
          {summary.openWorkOrders > 0 && (
            <AttentionItem icon="wrench" color="blue" to={to('/workshop/work-orders')}>
              {n(summary.openWorkOrders)} {t(summary.openWorkOrders === 1 ? 'work order' : 'work orders')} {t('open or in progress')}
            </AttentionItem>
          )}
          {nothing && <Quiet>{t('Nothing outstanding right now.')}</Quiet>}
        </Panel>
      </SimpleGrid>
    </Stack>
  );
}

function HrTab({ summary }: { summary: HrSummaryDto }) {
  const t = useT();
  const { language } = useLanguage();
  const slices = useSlices();
  const departmentMax = Math.max(1, ...summary.headcountByDepartment.map((row) => row.count));
  const employees = (status?: string) => to('/hr/employees', status ? { employmentStatus: status } : undefined);
  const day = today();
  const workforce = slices([
    { key: 'ACTIVE', label: t('Active'), value: summary.activeEmployees, color: WORKFORCE_COLOR.ACTIVE, to: employees('ACTIVE') },
    { key: 'ON_LEAVE', label: t('On leave'), value: summary.onLeaveEmployees, color: WORKFORCE_COLOR.ON_LEAVE, to: employees('ON_LEAVE') },
    { key: 'TERMINATED', label: t('Terminated'), value: summary.terminatedEmployees, color: WORKFORCE_COLOR.TERMINATED, to: employees('TERMINATED') },
  ]);
  return (
    <Stack gap="md">
      <SimpleGrid cols={STAT_COLS} spacing="md">
        <StatCard icon="users" color="blue" label="Total employees" value={summary.totalEmployees} to={employees()} />
        <StatCard icon="userCog" color="green" label="Active" value={summary.activeEmployees} to={employees('ACTIVE')} />
        <StatCard icon="calendar" color="orange" label="On leave" value={summary.onLeaveEmployees} to={employees('ON_LEAVE')} />
        <StatCard icon="building" color="grape" label="Departments" value={summary.departments} to={to('/hr/departments')} />
        <StatCard icon="fileCheck" color="teal" label="Present today" value={summary.presentToday} to={to('/hr/attendance', { status: 'PRESENT', fromDate: day, toDate: day })} />
        <StatCard icon="alert" color="pink" label="Absent / late today" value={summary.absentToday + summary.lateToday} to={to('/hr/attendance', { fromDate: day, toDate: day })} />
        <StatCard icon="clipboard" color="orange" label="Pending leave requests" value={summary.pendingLeaveRequests} to={to('/hr/leave-requests', { status: 'PENDING' })} />
        <StatCard icon="fileText" color="grape" label="Contracts expiring (30d)" value={summary.contractsExpiring} to={to('/hr/contracts', { status: 'ACTIVE' })} />
      </SimpleGrid>
      <SimpleGrid cols={PANEL_COLS} spacing="md">
        <Panel title="Headcount by department" subtitle="Where the active roster sits today.">
          {summary.headcountByDepartment.length === 0 ? (
            <Quiet>{t('No employees recorded yet.')}</Quiet>
          ) : (
            summary.headcountByDepartment.map((row) => <BarRow key={row.label} text={localizedJoinedName(row.label, row.labelAr, language) ?? row.label} value={row.count} max={departmentMax} color="blue" />)
          )}
        </Panel>
        <Panel title="Workforce status" subtitle="Active, on leave, and terminated employees.">
          {summary.totalEmployees === 0 ? <Quiet>{t('No employees recorded yet.')}</Quiet> : <DonutChart slices={workforce} totalCaption={t('Total employees')} ariaLabel={t('Workforce status')} />}
        </Panel>
      </SimpleGrid>
    </Stack>
  );
}

function WorkshopTab({ summary }: { summary: WorkshopSummaryDto }) {
  const t = useT();
  const n = useLocalizedDigits();
  const slices = useSlices();
  const workOrders = (filters?: Record<string, string>) => to('/workshop/work-orders', filters);
  const byPriority = [...summary.openByPriority].sort((a, b) => PRIORITY_ORDER.indexOf(a.label) - PRIORITY_ORDER.indexOf(b.label));
  const nothingOpen = byPriority.every((row) => row.count === 0);
  const nothingToFlag = summary.overdueMaintenance + summary.lowStockSpareParts + summary.failedInspections === 0;
  const priority = slices(byPriority.map((row) => ({ key: row.label, label: t(statusLabel(row.label)), value: row.count, color: PRIORITY_COLOR[row.label] ?? '#868e96', to: workOrders({ priority: row.label }) })));
  return (
    <Stack gap="md">
      <SimpleGrid cols={STAT_COLS} spacing="md">
        <StatCard icon="wrench" color="orange" label="Open work orders" value={summary.openWorkOrders} to={workOrders({ status: 'OPEN' })} />
        <StatCard icon="gauge" color="blue" label="In progress" value={summary.inProgressWorkOrders} to={workOrders({ status: 'IN_PROGRESS' })} />
        <StatCard icon="fileCheck" color="green" label="Completed this month" value={summary.completedThisMonth} to={workOrders({ status: 'COMPLETED' })} />
        <StatCard icon="alert" color="pink" label="Overdue maintenance" value={summary.overdueMaintenance} to={to('/workshop/maintenance')} />
        <StatCard icon="clipboard" color="grape" label="Failed inspections" value={summary.failedInspections} to={to('/workshop/inspections', { result: 'FAIL' })} />
        <StatCard icon="box" color="orange" label="Low stock spare parts" value={summary.lowStockSpareParts} to={to('/inventory')} />
        <StatCard icon="invoice" color="teal" label="Expenses this month" value={`${summary.expensesThisMonth} SAR`} to={to('/workshop/expenses', { fromDate: monthStart() })} />
      </SimpleGrid>
      <SimpleGrid cols={PANEL_COLS} spacing="md">
        <Panel title="Open work by priority" subtitle="Jobs not yet completed or cancelled.">
          {nothingOpen ? <Quiet>{t('Nothing open right now.')}</Quiet> : <DonutChart slices={priority} totalCaption={t('Open jobs')} ariaLabel={t('Open work by priority')} />}
        </Panel>
        <Panel title="Needs attention" subtitle="Open items pulled from the workshop.">
          {summary.overdueMaintenance > 0 && (
            <AttentionItem icon="alert" color="pink" to={to('/workshop/maintenance')}>
              {n(summary.overdueMaintenance)} {t(summary.overdueMaintenance === 1 ? 'maintenance schedule' : 'maintenance schedules')} {t('past due')}
            </AttentionItem>
          )}
          {summary.lowStockSpareParts > 0 && (
            <AttentionItem icon="box" color="orange" to={to('/inventory')}>
              {n(summary.lowStockSpareParts)} {t(summary.lowStockSpareParts === 1 ? 'spare part' : 'spare parts')} {t('at or below minimum stock')}
            </AttentionItem>
          )}
          {summary.failedInspections > 0 && (
            <AttentionItem icon="clipboard" color="grape" to={to('/workshop/inspections', { result: 'FAIL' })}>
              {n(summary.failedInspections)} {t(summary.failedInspections === 1 ? 'failed inspection' : 'failed inspections')} {t('on record')}
            </AttentionItem>
          )}
          {nothingToFlag && <Quiet>{t('Nothing outstanding right now.')}</Quiet>}
        </Panel>
      </SimpleGrid>
    </Stack>
  );
}

function MapTab({ summary, roster }: { summary: FleetSummaryDto; roster: ReturnType<typeof useDashboardViewModel>['roster'] }) {
  const t = useT();
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
        <StatCard icon="truck" color="orange" label="Fleet size" value={summary.fleetSize} to={to('/trucks')} />
        <StatCard icon="gauge" color="green" label="Active trucks" value={summary.activeTrucks} to={to('/trucks', { status: 'ACTIVE' })} />
        <StatCard icon="mapPin" color="blue" label="Live positions" value="—" />
      </SimpleGrid>
      <SimpleGrid cols={PANEL_COLS} spacing="md">
        <Paper p="xl">
          <Stack align="center" gap="sm" py="xl" ta="center">
            <ThemeIcon color="blue.7" size={56} radius="xl">
              <Icon.mapPin size={26} />
            </ThemeIcon>
            <Title order={3} fz="md">
              {t('Live tracker not connected yet')}
            </Title>
            <Text size="sm" c="dimmed" maw={380}>
              {t('This is where the real-time GPS positions of your trucks will show up once a tracking provider is wired in — pins moving on the map, trip routes, and geofence alerts.')}
            </Text>
          </Stack>
        </Paper>
        <Box>
          <Title order={3} fz="md">
            {t('Fleet roster')}
          </Title>
          <Text size="sm" c="dimmed" mb="sm">
            {t('Trucks that will appear on the map once tracking is connected.')}
          </Text>
          <DataTable<TruckDto>
            columns={[
              { id: 'number', header: 'Truck number', cell: (truck) => <Mono>{truck.truckNumber}</Mono> },
              { id: 'type', header: 'Type', cell: (truck) => truck.truckType || '—' },
              { id: 'status', header: 'Status', cell: (truck) => <StatusBadge status={truck.status} /> },
            ]}
            rows={roster.rows}
            rowKey={(truck) => truck.id}
            loading={roster.loading}
            fetching={roster.fetching}
            error={roster.error}
            emptyLabel="No trucks recorded yet."
            pagination={roster.pagination}
            onPageChange={roster.setPage}
          />
        </Box>
      </SimpleGrid>
    </Stack>
  );
}

function DashboardBody() {
  const vm = useDashboardViewModel();
  const { language } = useLanguage();
  const t = useT();

  return (
    <Stack gap="md">
      <Paper p="lg">
        <Group justify="space-between" wrap="nowrap">
          <Box>
            <Title order={2} fz="xl">
              {t('Welcome back,')} {vm.user?.name}
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              {t('Role:')} {vm.user?.role ? t(vm.user.role) : t('None')} &nbsp;·&nbsp; {t('Language:')} {language === 'ar' ? 'العربية' : 'English'}
            </Text>
          </Box>
          <Avatar color="brand" radius="xl" size={44}>
            {(vm.user?.name ?? '?').slice(0, 1).toUpperCase()}
          </Avatar>
        </Group>
      </Paper>

      <Tabs value={vm.tab} onChange={(value) => value && vm.setTab(value as DashboardTab)} keepMounted={false}>
        <Tabs.List mb="md">
          {vm.tabs.map((tab) => {
            const TabIcon = Icon[tab.icon];
            return (
              <Tabs.Tab key={tab.key} value={tab.key} leftSection={<TabIcon size={14} />}>
                {t(tab.label)}
              </Tabs.Tab>
            );
          })}
        </Tabs.List>
        <Tabs.Panel value="operations">
          <SummaryState data={vm.operations.data} error={vm.operations.error}>
            {(summary) => <OperationsTab summary={summary} fleet={vm.fleetForOperations} />}
          </SummaryState>
        </Tabs.Panel>
        <Tabs.Panel value="hr">
          <SummaryState data={vm.hr.data} error={vm.hr.error}>
            {(summary) => <HrTab summary={summary} />}
          </SummaryState>
        </Tabs.Panel>
        <Tabs.Panel value="workshop">
          <SummaryState data={vm.workshop.data} error={vm.workshop.error}>
            {(summary) => <WorkshopTab summary={summary} />}
          </SummaryState>
        </Tabs.Panel>
        <Tabs.Panel value="map">
          <SummaryState data={vm.fleet.data} error={vm.fleet.error}>
            {(summary) => <MapTab summary={summary} roster={vm.roster} />}
          </SummaryState>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

export function DashboardScreen() {
  return (
    <AppShell title="Dashboard">
      <DashboardBody />
    </AppShell>
  );
}
