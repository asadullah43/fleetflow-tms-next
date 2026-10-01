'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CrudApi } from '../../lib/api/crud-api';
import { queryKeys } from '../../lib/api/query-keys';
import type { ListQuery } from '../../lib/api/types';

/** One server page of a resource. The previous page stays on screen while the next one loads. */
export function useResourceList<T>(api: Pick<CrudApi<T>, 'key' | 'list'>, query: ListQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.list(api.key, query),
    queryFn: () => api.list(query),
    placeholderData: keepPreviousData,
    enabled,
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
