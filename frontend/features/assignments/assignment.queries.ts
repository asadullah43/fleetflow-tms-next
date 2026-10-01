'use client';

import { useQuery } from '@tanstack/react-query';
import { assignmentsApi } from '../../lib/api/assignments.api';
import { queryKeys } from '../../lib/api/query-keys';
import { today } from '../../lib/date';

/** A truck's full assignment history, newest first. */
export function useTruckAssignments(truckId: number | null) {
  return useQuery({
    queryKey: queryKeys.list(assignmentsApi.key, { filters: { truckId: String(truckId) }, sortBy: 'startDate', sortOrder: 'desc', pageSize: 100 }),
    queryFn: () => assignmentsApi.listAll({ filters: { truckId: String(truckId) }, sortBy: 'startDate', sortOrder: 'desc' }, 500),
    enabled: truckId !== null,
  });
}

/** The assignment in effect for a truck today, if any (the backend applies the same rule when a trip is saved). */
export function useCurrentAssignment(truckId: number | null) {
  const day = today();
  return useQuery({
    queryKey: queryKeys.truckAssignment(truckId ?? 0, day),
    queryFn: async () => (await assignmentsApi.list({ filters: { truckId: String(truckId), activeOn: day }, sortBy: 'startDate', sortOrder: 'desc', pageSize: 1 })).items[0] ?? null,
    enabled: truckId !== null,
  });
}
