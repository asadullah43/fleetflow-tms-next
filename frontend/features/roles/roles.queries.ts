'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/api/query-keys';
import { rolesApi } from '../../lib/api/roles.api';

/** The fixed list of permission modules — it only changes with a new release, so it is fetched once. */
export function usePermissionModules() {
  return useQuery({ queryKey: queryKeys.permissionModules(), queryFn: rolesApi.getPermissionModules, staleTime: Infinity });
}
