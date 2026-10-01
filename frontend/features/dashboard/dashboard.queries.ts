'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../lib/api/dashboard.api';
import { queryKeys } from '../../lib/api/query-keys';

// Each tab's figures load only when that tab is opened (`enabled`).
export const useOperationsSummary = () => useQuery({ queryKey: queryKeys.dashboard('operations'), queryFn: dashboardApi.getSummary });
export const useHrSummary = (enabled: boolean) => useQuery({ queryKey: queryKeys.dashboard('hr'), queryFn: dashboardApi.getHrSummary, enabled });
export const useWorkshopSummary = (enabled: boolean) => useQuery({ queryKey: queryKeys.dashboard('workshop'), queryFn: dashboardApi.getWorkshopSummary, enabled });
export const useFleetSummary = (enabled: boolean) => useQuery({ queryKey: queryKeys.dashboard('fleet'), queryFn: dashboardApi.getFleetSummary, enabled });
