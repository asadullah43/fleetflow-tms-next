import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { PERMISSION_MODULES } from './roles.constants.js';

function fail(code: { code: string; filter: any; description: string }, statusCode: number, cause?: unknown): never {
  throw new AppError({ errorCode: code.code, errorFilter: code.filter, errorDescription: code.description, statusCode, cause: cause as Error });
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

  getPermissionModules() {
    return PERMISSION_MODULES;
  },

  async create(dto: { name: string; description?: string; permissions?: PermissionInput[] }) {
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
    await this.findOne(id);
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
    await this.findOne(id);
    const usersOnRole = await prisma.user.count({ where: { roleId: id } });
    if (usersOnRole > 0) fail(ErrorCode.ROL_HAS_USERS, 400);
    try {
      await prisma.permission.deleteMany({ where: { roleId: id } });
      await prisma.role.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.ROL_DELETE_FAILED, 500, error);
    }
  },
};
