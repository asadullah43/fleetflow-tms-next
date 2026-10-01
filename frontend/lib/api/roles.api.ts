import { fleetflow } from '../generated/proto/messages.js';
import { apiCall } from './client';
import { createCrudApi } from './crud-api';

const SERVICE = 'fleetflow.roles.RolesService';

export interface PermissionDto {
  module: string;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface RoleDto {
  id: number;
  name: string;
  description?: string;
  permissions: PermissionDto[];
}

export const rolesApi = {
  ...createCrudApi<RoleDto>('roles', SERVICE, fleetflow.roles, 'Role'),
  /** The fixed list of modules a permission matrix covers. */
  getPermissionModules: () =>
    apiCall<{ modules?: string[] }>({ service: SERVICE, method: 'GetPermissionModules', RequestType: fleetflow.roles.ListRequest }).then((res) => res.modules ?? []),
};
