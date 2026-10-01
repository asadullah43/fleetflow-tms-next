import { ListQuery, normalizeListQuery } from './types';

/**
 * Every TanStack Query key in the app is built here, so invalidation is
 * predictable: `queryKeys.resource('trucks')` matches every cached list,
 * lookup and detail of trucks at once.
 */
export const queryKeys = {
  resource: (key: string) => [key] as const,
  list: (key: string, query: ListQuery) => [key, 'list', normalizeListQuery(query)] as const,
  detail: (key: string, id: number) => [key, 'detail', id] as const,
  /** Dropdown options: a small searched page of a resource. */
  lookup: (key: string, search: string, filters?: Record<string, string>) => [key, 'lookup', search.trim(), filters ?? {}] as const,

  session: () => ['session'] as const,
  branding: () => ['branding'] as const,
  companySettings: () => ['companySettings'] as const,
  permissionModules: () => ['roles', 'modules'] as const,
  dashboard: (section: 'operations' | 'hr' | 'workshop' | 'fleet') => ['dashboard', section] as const,
  loadingOrderDocument: (batchId: number) => ['loadingOrders', 'document', batchId] as const,
  truckAssignment: (truckId: number, day: string) => ['assignments', 'current', truckId, day] as const,
};
