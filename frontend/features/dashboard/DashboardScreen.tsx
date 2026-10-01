'use client';

import { Avatar, Box, Group, Paper, SimpleGrid, Stack, Tabs, Text, ThemeIcon, Title } from '@mantine/core';
import { AppShell } from '../../components/AppShell';
import { DataTable } from '../../components/DataTable';
import { Icon } from '../../components/icons';
import { StatusBadge, statusLabel } from '../../components/StatusBadge';
import type { DashboardSummaryDto, FleetSummaryDto, HrSummaryDto, WorkshopSummaryDto } from '../../lib/api/dashboard.api';
import type { TruckDto } from '../../lib/api/trucks.api';
import { useLanguage, useLocalizedDigits, useT } from '../../lib/language-context';
import { localizedJoinedName } from '../../lib/localized-name';
import { AttentionItem, BarRow, Panel, Quiet, StatCard, SummaryState } from './dashboard-widgets';
import { DashboardTab, useDashboardViewModel } from './use-dashboard-view-model';

const STAT_COLS = { base: 1, xs: 2, md: 3, xl: 4 };
const PANEL_COLS = { base: 1, lg: 2 };

function OperationsTab({ summary }: { summary: DashboardSummaryDto }) {
  const t = useT();
  const n = useLocalizedDigits();
  const snapshot = [
    { label: 'Active trucks', value: summary.activeTrucks, color: 'orange' },
    { label: 'Active drivers', value: summary.activeDrivers, color: 'blue' },
    { label: 'Trips (MTD)', value: summary.tripsThisMonth, color: 'teal' },
    { label: 'Open work orders', value: summary.openWorkOrders, color: 'pink' },
  ];
  const max = Math.max(1, ...snapshot.map((row) => row.value));
  const nothing = summary.lowStockSpareParts + summary.unpaidInvoicesCount + summary.pendingLeaveRequests + summary.openWorkOrders === 0;

  return (
    <Stack gap="md">
      <SimpleGrid cols={STAT_COLS} spacing="md">
        <StatCard icon="truck" color="orange" label="Active trucks" value={summary.activeTrucks} />
        <StatCard icon="driver" color="blue" label="Active drivers" value={summary.activeDrivers} />
        <StatCard icon="route" color="teal" label="Trips this month" value={summary.tripsThisMonth} />
        <StatCard icon="wrench" color="pink" label="Open work orders" value={summary.openWorkOrders} />
        <StatCard icon="invoice" color="grape" label="Unpaid invoices" value={`${summary.unpaidInvoicesCount} · ${summary.unpaidInvoicesTotal} SAR`} />
        <StatCard icon="calendar" color="green" label="Pending leave requests" value={summary.pendingLeaveRequests} />
        <StatCard icon="box" color="orange" label="Low stock spare parts" value={summary.lowStockSpareParts} />
      </SimpleGrid>
      <SimpleGrid cols={PANEL_COLS} spacing="md">
        <Panel title="This month at a glance" subtitle="Active fleet & operational load, side by side.">
          {snapshot.map((row) => (
            <BarRow key={row.label} text={t(row.label)} value={row.value} max={max} color={row.color} />
          ))}
        </Panel>
        <Panel title="Needs attention" subtitle="Open items pulled from across the fleet.">
          {summary.lowStockSpareParts > 0 && (
            <AttentionItem icon="box" color="pink">
              {n(summary.lowStockSpareParts)} {t(summary.lowStockSpareParts === 1 ? 'spare part' : 'spare parts')} {t('at or below minimum stock')}
            </AttentionItem>
          )}
          {summary.unpaidInvoicesCount > 0 && (
            <AttentionItem icon="invoice" color="orange">
              {n(summary.unpaidInvoicesCount)} {t(summary.unpaidInvoicesCount === 1 ? 'unpaid invoice' : 'unpaid invoices')} {t('totalling')} {n(summary.unpaidInvoicesTotal)} {t('SAR')}
            </AttentionItem>
          )}
          {summary.pendingLeaveRequests > 0 && (
            <AttentionItem icon="calendar" color="grape">
              {n(summary.pendingLeaveRequests)} {t(summary.pendingLeaveRequests === 1 ? 'leave request' : 'leave requests')} {t('awaiting approval')}
            </AttentionItem>
          )}
          {summary.openWorkOrders > 0 && (
            <AttentionItem icon="wrench" color="blue">
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
  const departmentMax = Math.max(1, ...summary.headcountByDepartment.map((row) => row.count));
  return (
    <Stack gap="md">
      <SimpleGrid cols={STAT_COLS} spacing="md">
        <StatCard icon="users" color="blue" label="Total employees" value={summary.totalEmployees} />
        <StatCard icon="userCog" color="green" label="Active" value={summary.activeEmployees} />
        <StatCard icon="calendar" color="orange" label="On leave" value={summary.onLeaveEmployees} />
        <StatCard icon="building" color="grape" label="Departments" value={summary.departments} />
        <StatCard icon="fileCheck" color="teal" label="Present today" value={summary.presentToday} />
        <StatCard icon="alert" color="pink" label="Absent / late today" value={summary.absentToday + summary.lateToday} />
        <StatCard icon="clipboard" color="orange" label="Pending leave requests" value={summary.pendingLeaveRequests} />
        <StatCard icon="fileText" color="grape" label="Contracts expiring (30d)" value={summary.contractsExpiring} />
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
          <BarRow text={t('Active')} value={summary.activeEmployees} max={Math.max(1, summary.totalEmployees)} color="green" />
          <BarRow text={t('On leave')} value={summary.onLeaveEmployees} max={Math.max(1, summary.totalEmployees)} color="orange" />
          <BarRow text={t('Terminated')} value={summary.terminatedEmployees} max={Math.max(1, summary.totalEmployees)} color="pink" />
        </Panel>
      </SimpleGrid>
    </Stack>
  );
}

function WorkshopTab({ summary }: { summary: WorkshopSummaryDto }) {
  const t = useT();
  const n = useLocalizedDigits();
  const priorityMax = Math.max(1, ...summary.openByPriority.map((row) => row.count));
  const nothingOpen = summary.openByPriority.every((row) => row.count === 0);
  const nothingToFlag = summary.overdueMaintenance + summary.lowStockSpareParts + summary.failedInspections === 0;
  return (
    <Stack gap="md">
      <SimpleGrid cols={STAT_COLS} spacing="md">
        <StatCard icon="wrench" color="orange" label="Open work orders" value={summary.openWorkOrders} />
        <StatCard icon="gauge" color="blue" label="In progress" value={summary.inProgressWorkOrders} />
        <StatCard icon="fileCheck" color="green" label="Completed this month" value={summary.completedThisMonth} />
        <StatCard icon="alert" color="pink" label="Overdue maintenance" value={summary.overdueMaintenance} />
        <StatCard icon="clipboard" color="grape" label="Failed inspections" value={summary.failedInspections} />
        <StatCard icon="box" color="orange" label="Low stock spare parts" value={summary.lowStockSpareParts} />
        <StatCard icon="invoice" color="teal" label="Expenses this month" value={`${summary.expensesThisMonth} SAR`} />
      </SimpleGrid>
      <SimpleGrid cols={PANEL_COLS} spacing="md">
        <Panel title="Open work by priority" subtitle="Jobs not yet completed or cancelled.">
          {nothingOpen ? <Quiet>{t('Nothing open right now.')}</Quiet> : summary.openByPriority.map((row) => <BarRow key={row.label} text={t(statusLabel(row.label))} value={row.count} max={priorityMax} color="orange" />)}
        </Panel>
        <Panel title="Needs attention" subtitle="Open items pulled from the workshop.">
          {summary.overdueMaintenance > 0 && (
            <AttentionItem icon="alert" color="pink">
              {n(summary.overdueMaintenance)} {t(summary.overdueMaintenance === 1 ? 'maintenance schedule' : 'maintenance schedules')} {t('past due')}
            </AttentionItem>
          )}
          {summary.lowStockSpareParts > 0 && (
            <AttentionItem icon="box" color="orange">
              {n(summary.lowStockSpareParts)} {t(summary.lowStockSpareParts === 1 ? 'spare part' : 'spare parts')} {t('at or below minimum stock')}
            </AttentionItem>
          )}
          {summary.failedInspections > 0 && (
            <AttentionItem icon="clipboard" color="grape">
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
        <StatCard icon="truck" color="orange" label="Fleet size" value={summary.fleetSize} />
        <StatCard icon="gauge" color="green" label="Active trucks" value={summary.activeTrucks} />
        <StatCard icon="mapPin" color="blue" label="Live positions" value="—" />
      </SimpleGrid>
      <SimpleGrid cols={PANEL_COLS} spacing="md">
        <Paper p="xl">
          <Stack align="center" gap="sm" py="xl" ta="center">
            <ThemeIcon variant="light" color="blue" size={56} radius="xl">
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
              { id: 'number', header: 'Truck number', cell: (truck) => <Text span ff="monospace" fz="sm">{truck.truckNumber}</Text> },
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
            {(summary) => <OperationsTab summary={summary} />}
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
