'use client';

import { keepPreviousData, QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CrudApi } from '../../lib/api/crud-api';
import { queryKeys } from '../../lib/api/query-keys';
import type { ListQuery, Page } from '../../lib/api/types';

/** One server page of a resource. The previous page stays on screen while the next one loads. */
export function useResourceList<T>(api: Pick<CrudApi<T>, 'key' | 'list'>, query: ListQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.list(api.key, query),
    queryFn: () => api.list(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** A row of this resource already held by a cached list or lookup page, with when that page was fetched. */
function cachedRow<T extends { id: number }>(queryClient: QueryClient, key: string, id: number): { row: T; updatedAt: number } | undefined {
  for (const [queryKey, data] of queryClient.getQueriesData<Page<T>>({ queryKey: queryKeys.resource(key) })) {
    const row = Array.isArray(data?.items) ? data.items.find((item) => item.id === id) : undefined;
    if (row) return { row, updatedAt: queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? 0 };
  }
  return undefined;
}

/**
 * One record by id. When the record was just on screen in a list or a
 * dropdown, that copy is shown at once and no request is made until it
 * goes stale like the page it came from.
 */
export function useResourceDetail<T extends { id: number }>(api: Pick<CrudApi<T>, 'key' | 'get'>, id: number, { enabled = true, staleTime }: { enabled?: boolean; staleTime?: number } = {}) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.detail(api.key, id),
    queryFn: () => api.get(id),
    enabled,
    staleTime,
    initialData: () => cachedRow<T>(queryClient, api.key, id)?.row,
    initialDataUpdatedAt: () => cachedRow<T>(queryClient, api.key, id)?.updatedAt,
  });
}

/**
 * Create / update / delete for a resource. A successful write invalidates
 * every cached query of that resource (lists, lookups, details) and the
 * dashboard figures derived from it.
 */
export function useResourceMutations<T>(api: CrudApi<T>) {
  const queryClient = useQueryClient();
  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.resource(api.key) });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const create = useMutation({
    mutationFn: ({ values, idempotencyKey }: { values: Record<string, unknown>; idempotencyKey: string }) => api.create(values, idempotencyKey),
    onSuccess,
  });
  const update = useMutation({
    mutationFn: ({ id, values }: { id: number; values: Record<string, unknown> }) => api.update(id, values),
    onSuccess,
  });
  const remove = useMutation({ mutationFn: (id: number) => api.remove(id), onSuccess });

  return { create, update, remove };
}
