import { fleetflow } from '../generated/proto/messages.js';
import { unaryCall } from './client';

const { Role, RoleList, ListRequest, IdRequest, CreateRoleRequest, UpdateRoleRequest, DeleteResponse, ModuleList, Permission } = fleetflow.roles;

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

export const rolesClient = {
  list(token: string): Promise<RoleDto[]> {
    return unaryCall({ serviceName: SERVICE, methodName: 'List', request: ListRequest.create({}), RequestType: ListRequest, ResponseType: RoleList, token }).then(
      (res: any) => res.items ?? [],
    );
  },
  get(id: number, token: string): Promise<RoleDto> {
    return unaryCall({ serviceName: SERVICE, methodName: 'Get', request: IdRequest.create({ id }), RequestType: IdRequest, ResponseType: Role, token }) as Promise<RoleDto>;
  },
  create(dto: { name: string; description?: string; permissions: PermissionDto[] }, token: string): Promise<RoleDto> {
    return unaryCall({
      serviceName: SERVICE,
      methodName: 'Create',
      request: CreateRoleRequest.create({ ...dto, permissions: dto.permissions.map((p) => Permission.create(p)) }),
      RequestType: CreateRoleRequest,
      ResponseType: Role,
      token,
    }) as Promise<RoleDto>;
  },
  update(id: number, dto: { name?: string; description?: string; permissions: PermissionDto[] }, token: string): Promise<RoleDto> {
    return unaryCall({
      serviceName: SERVICE,
      methodName: 'Update',
      request: UpdateRoleRequest.create({ id, ...dto, permissions: dto.permissions.map((p) => Permission.create(p)) }),
      RequestType: UpdateRoleRequest,
      ResponseType: Role,
      token,
    }) as Promise<RoleDto>;
  },
  remove(id: number, token: string): Promise<void> {
    return unaryCall({ serviceName: SERVICE, methodName: 'Delete', request: IdRequest.create({ id }), RequestType: IdRequest, ResponseType: DeleteResponse, token }).then(
      () => undefined,
    );
  },
  getPermissionModules(token: string): Promise<string[]> {
    return unaryCall({
      serviceName: SERVICE,
      methodName: 'GetPermissionModules',
      request: ListRequest.create({}),
      RequestType: ListRequest,
      ResponseType: ModuleList,
      token,
    }).then((res: any) => res.modules ?? []);
  },
};
