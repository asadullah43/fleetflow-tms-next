'use client';

import { useMemo, useState } from 'react';
import type { IconName } from '../../components/icons';
import { errorMessage } from '../../lib/api/errors';
import { trucksApi } from '../../lib/api/trucks.api';
import { useAuth } from '../auth/session-provider';
import { useResourceList } from '../crud/crud.queries';
import { useFleetSummary, useHrSummary, useOperationsSummary, useWorkshopSummary } from './dashboard.queries';

export type DashboardTab = 'operations' | 'hr' | 'workshop' | 'map';

/** `module`: extra permission (beyond dashboard:view) a tab's data needs — the tab is hidden without it. */
const TABS: { key: DashboardTab; label: string; icon: IconName; module?: string }[] = [
  { key: 'operations', label: 'Operations', icon: 'gauge' },
  { key: 'hr', label: 'HR Dashboard', icon: 'userCog', module: 'hr' },
  { key: 'workshop', label: 'Workshop Dashboard', icon: 'wrench', module: 'workshop' },
  { key: 'map', label: 'Map', icon: 'mapPin' },
];

const ROSTER_PAGE_SIZE = 10;

/** Which tabs the user may open, which is open, and each tab's server-computed figures. */
export function useDashboardViewModel() {
  const { user, can } = useAuth();
  const [tab, setTab] = useState<DashboardTab>('operations');
  const [rosterPage, setRosterPage] = useState(1);
  const tabs = useMemo(() => TABS.filter((entry) => !entry.module || can(entry.module, 'view')), [can]);

  const operations = useOperationsSummary();
  const hr = useHrSummary(tab === 'hr');
  const workshop = useWorkshopSummary(tab === 'workshop');
  const fleet = useFleetSummary(tab === 'map');
  const roster = useResourceList(trucksApi, { page: rosterPage, pageSize: ROSTER_PAGE_SIZE, sortBy: 'truckNumber', sortOrder: 'asc' }, tab === 'map');

  const failure = (query: { isError: boolean; error: unknown }) => (query.isError ? errorMessage(query.error) : null);

  return {
    user,
    tabs,
    tab,
    setTab,
    operations: { data: operations.data, error: failure(operations) },
    hr: { data: hr.data, error: failure(hr) },
    workshop: { data: workshop.data, error: failure(workshop) },
    fleet: { data: fleet.data, error: failure(fleet) },
    roster: { rows: roster.data?.items, pagination: roster.data?.pagination, loading: roster.isPending, fetching: roster.isFetching && !roster.isPending, error: failure(roster), setPage: setRosterPage },
  };
}
