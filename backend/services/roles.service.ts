import { prisma } from '../_core_app_connectivities/prisma.js';
import { currentCompanyId } from '../_core_app_connectivities/tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { ErrorCode } from '../global_config/error-codes.js';
import type { ListQuery } from '../models/api-response.js';
import { ListConfig, paginate } from '../utils/pagination.js';
import { PERMISSION_MODULES, isAdminRole, isPermissionModule } from '../utils/permissions.js';

interface PermissionInput {
  module: string;
  canView?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

interface RoleInput {
  name?: string;
  description?: string;
  permissions?: PermissionInput[];
}

const LIST: ListConfig = {
  searchFields: ['name', 'description'],
  sortFields: { id: 'id', name: 'name' },
  defaultSort: { field: 'id', order: 'asc' },
};

const INCLUDE = { permissions: true } as const;

function assertKnownModules(permissions: PermissionInput[] | undefined): void {
  if (permissions?.some((p) => !isPermissionModule(p.module))) throw AppError.from(ErrorCode.ROL_UNKNOWN_MODULE, 400);
}

const flags = (p: PermissionInput | undefined) => ({
  canView: p?.canView ?? false,
  canAdd: p?.canAdd ?? false,
  canEdit: p?.canEdit ?? false,
  canDelete: p?.canDelete ?? false,
});

function mapOut(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    permissions: (row.permissions ?? []).map((p: any) => ({ module: p.module, ...flags(p) })),
  };
}

/**
 * A Role plus one Permission row per module in PERMISSION_MODULES. Role
 * names are unique within a company. The built-in ADMIN role bypasses
 * the matrix, so it can be neither renamed nor deleted.
 */
export const rolesService = {
  async list(query: ListQuery) {
    try {
      return await paginate(prisma.role, query, LIST, { extra: { include: INCLUDE }, map: mapOut });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.ROL_FETCH_FAILED, 500, error);
    }
  },

  async findOne(id: number) {
    const row = await prisma.role.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw AppError.from(ErrorCode.ROL_NOT_FOUND, 404);
    return mapOut(row);
  },

  getPermissionModules() {
    return { modules: [...PERMISSION_MODULES] };
  },

  async create(input: RoleInput & { name: string }) {
    assertKnownModules(input.permissions);
    try {
      const row = await prisma.role.create({
        data: {
          companyId: currentCompanyId(),
          name: input.name,
          description: input.description,
          permissions: { create: PERMISSION_MODULES.map((module) => ({ module, ...flags(input.permissions?.find((p) => p.module === module)) })) },
        },
        include: INCLUDE,
      });
      return mapOut(row);
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') throw AppError.from(ErrorCode.ROL_DUPLICATE_NAME, 409, error);
      throw AppError.from(ErrorCode.ROL_CREATE_FAILED, 500, error);
    }
  },

  async update(id: number, input: RoleInput) {
    const existing = await this.findOne(id);
    // ADMIN's full access is keyed on its name — renaming it would silently strip every admin's rights.
    if (isAdminRole(existing.name) && input.name && !isAdminRole(input.name)) throw AppError.from(ErrorCode.ROL_PROTECTED, 400);
    assertKnownModules(input.permissions);
    try {
      // Name and matrix change together or not at all.
      await prisma.$transaction(async (tx) => {
        await tx.role.update({ where: { id }, data: { name: input.name || undefined, description: input.description } });
        for (const p of input.permissions ?? []) {
          await tx.permission.upsert({
            where: { roleId_module: { roleId: id, module: p.module } },
            create: { roleId: id, module: p.module, ...flags(p) },
            update: flags(p),
          });
        }
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') throw AppError.from(ErrorCode.ROL_DUPLICATE_NAME, 409, error);
      throw AppError.from(ErrorCode.ROL_UPDATE_FAILED, 500, error);
    }
    return this.findOne(id);
  },

  async remove(id: number) {
    const existing = await this.findOne(id);
    if (isAdminRole(existing.name)) throw AppError.from(ErrorCode.ROL_PROTECTED, 400);
    const usersOnRole = await prisma.user.count({ where: { roleId: id } });
    if (usersOnRole > 0) throw AppError.from(ErrorCode.ROL_HAS_USERS, 400);
    try {
      // Permission rows cascade on delete (schema: onDelete: Cascade).
      await prisma.role.delete({ where: { id } });
    } catch (error) {
      throw AppError.from(ErrorCode.ROL_DELETE_FAILED, 500, error);
    }
  },
};
