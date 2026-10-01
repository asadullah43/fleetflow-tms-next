import { prisma } from '../../lib/prisma.js';
import { fail } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { PERMISSION_MODULES, isAdminRole, isPermissionModule } from '../../common/auth/permissions.js';

function assertKnownModules(permissions: PermissionInput[] | undefined): void {
  if (permissions?.some((p) => !isPermissionModule(p.module))) fail(ErrorCode.ROL_UNKNOWN_MODULE, 400);
}

function mapOut(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    permissions: (row.permissions ?? []).map((p: any) => ({
      module: p.module,
      canView: p.canView,
      canAdd: p.canAdd,
      canEdit: p.canEdit,
      canDelete: p.canDelete,
    })),
  };
}

interface PermissionInput {
  module: string;
  canView?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

/**
 * Direct port of the legacy RolesService: a Role plus one Permission row
 * per module in PERMISSION_MODULES. Every create/update replaces the full
 * permission matrix in one transaction, same as the legacy service did.
 */
export const rolesService = {
  async findAll() {
    const rows = await prisma.role.findMany({ include: { permissions: true }, orderBy: { id: 'asc' } });
    return rows.map(mapOut);
  },

  async findOne(id: number) {
    const row = await prisma.role.findUnique({ where: { id }, include: { permissions: true } });
    if (!row) fail(ErrorCode.ROL_NOT_FOUND, 404);
    return mapOut(row);
  },

  getPermissionModules(): string[] {
    return [...PERMISSION_MODULES];
  },

  async create(dto: { name: string; description?: string; permissions?: PermissionInput[] }) {
    if (!dto.name?.trim()) fail(ErrorCode.SYS_VALIDATION_ERROR, 400);
    assertKnownModules(dto.permissions);
    try {
      const permissionRows = PERMISSION_MODULES.map((module) => {
        const found = dto.permissions?.find((p) => p.module === module);
        return {
          module,
          canView: found?.canView ?? false,
          canAdd: found?.canAdd ?? false,
          canEdit: found?.canEdit ?? false,
          canDelete: found?.canDelete ?? false,
        };
      });
      const row = await prisma.role.create({
        data: {
          name: dto.name,
          description: dto.description,
          permissions: { create: permissionRows },
        },
        include: { permissions: true },
      });
      return mapOut(row);
    } catch (error) {
      fail(ErrorCode.ROL_CREATE_FAILED, 500, error);
    }
  },

  async update(id: number, dto: { name?: string; description?: string; permissions?: PermissionInput[] }) {
    const existing = await this.findOne(id);
    // ADMIN's full access is keyed on its name — renaming it would silently strip every admin's rights.
    if (isAdminRole(existing.name) && dto.name !== undefined && !isAdminRole(dto.name)) fail(ErrorCode.ROL_PROTECTED, 400);
    assertKnownModules(dto.permissions);
    try {
      await prisma.$transaction(async (tx: any) => {
        await tx.role.update({ where: { id }, data: { name: dto.name, description: dto.description } });
        if (dto.permissions) {
          for (const p of dto.permissions) {
            await tx.permission.upsert({
              where: { roleId_module: { roleId: id, module: p.module } },
              create: {
                roleId: id,
                module: p.module,
                canView: p.canView ?? false,
                canAdd: p.canAdd ?? false,
                canEdit: p.canEdit ?? false,
                canDelete: p.canDelete ?? false,
              },
              update: {
                canView: p.canView ?? false,
                canAdd: p.canAdd ?? false,
                canEdit: p.canEdit ?? false,
                canDelete: p.canDelete ?? false,
              },
            });
          }
        }
      });
      return this.findOne(id);
    } catch (error) {
      fail(ErrorCode.ROL_UPDATE_FAILED, 500, error);
    }
  },

  async remove(id: number) {
    const existing = await this.findOne(id);
    if (isAdminRole(existing.name)) fail(ErrorCode.ROL_PROTECTED, 400);
    const usersOnRole = await prisma.user.count({ where: { roleId: id } });
    if (usersOnRole > 0) fail(ErrorCode.ROL_HAS_USERS, 400);
    try {
      // Permission rows cascade on delete (schema: onDelete: Cascade).
      await prisma.role.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.ROL_DELETE_FAILED, 500, error);
    }
  },
};
