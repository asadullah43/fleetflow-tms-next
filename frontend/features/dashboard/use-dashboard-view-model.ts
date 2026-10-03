'use client';

import { useMemo } from 'react';
import type { IconName } from '../../components/icons';
import { errorMessage } from '../../lib/api/errors';
import { trucksApi } from '../../lib/api/trucks.api';
import { DashboardTab, useUiStore } from '../../stores/ui.store';
import { useAuth } from '../auth/session-provider';
import { useResourceList } from '../crud/crud.queries';
import { useListControls } from '../crud/use-list-controls';
import { useFleetSummary, useHrSummary, useInventorySummary, useOperationsSummary, useWorkshopSummary } from './dashboard.queries';

export type { DashboardTab };

/** `module`: extra permission (beyond dashboard:view) a tab's data needs — the tab is hidden without it. */
const TABS: { key: DashboardTab; label: string; icon: IconName; module?: string }[] = [
  { key: 'operations', label: 'Operations', icon: 'gauge' },
  { key: 'hr', label: 'HR Dashboard', icon: 'userCog', module: 'hr' },
  { key: 'workshop', label: 'Workshop Dashboard', icon: 'wrench', module: 'workshop' },
  { key: 'inventory', label: 'Inventory Dashboard', icon: 'box', module: 'inventory' },
  { key: 'map', label: 'Map', icon: 'mapPin' },
];

const ROSTER_PAGE_SIZE = 10;

/**
 * Which tabs the user may open, which is open (remembered in the UI
 * store), and each tab's server-computed figures. A tab's figures are
 * requested only while it is open; the fleet figures are shared by the
 * Operations and Map tabs (one request, one cache entry).
 */
export function useDashboardViewModel() {
  const { user, can } = useAuth();
  const storedTab = useUiStore((state) => state.dashboardTab);
  const setTab = useUiStore((state) => state.setDashboardTab);
  const tabs = useMemo(() => TABS.filter((entry) => !entry.module || can(entry.module, 'view')), [can]);
  // A remembered tab this user may no longer open falls back to the first one — and its data is never requested.
  const tab = tabs.some((entry) => entry.key === storedTab) ? storedTab : 'operations';

  const operations = useOperationsSummary(tab === 'operations');
  const hr = useHrSummary(tab === 'hr');
  const workshop = useWorkshopSummary(tab === 'workshop');
  const inventory = useInventorySummary(tab === 'inventory');
  const fleet = useFleetSummary(tab === 'operations' || tab === 'map');
  const rosterControls = useListControls({ scope: 'dashboard:roster', initialPageSize: ROSTER_PAGE_SIZE });
  const roster = useResourceList(trucksApi, { ...rosterControls.query, sortBy: 'truckNumber', sortOrder: 'asc' }, tab === 'map');

  const failure = (query: { isError: boolean; error: unknown }) => (query.isError ? errorMessage(query.error) : null);

  return {
    user,
    tabs,
    tab,
    setTab,
    operations: { data: operations.data, error: failure(operations) },
    /** Operations shows the fleet meter only once its figures arrive; a failure there leaves the rest of the tab intact. */
    fleetForOperations: fleet.data,
    hr: { data: hr.data, error: failure(hr) },
    workshop: { data: workshop.data, error: failure(workshop) },
    inventory: { data: inventory.data, error: failure(inventory) },
    fleet: { data: fleet.data, error: failure(fleet) },
    roster: { rows: roster.data?.items, pagination: roster.data?.pagination, loading: roster.isPending, fetching: roster.isFetching && !roster.isPending, error: failure(roster), setPage: rosterControls.setPage },
  };
}
