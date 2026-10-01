import { prisma } from '../_core_app_connectivities/prisma.js';
import { currentCompanyId } from '../_core_app_connectivities/tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { ErrorCode } from '../global_config/error-codes.js';
import type { ListQuery } from '../models/api-response.js';
import type { Principal } from '../models/auth-context.js';
import { generateApiKey } from '../utils/api-key.js';
import { filter, ListConfig, paginate } from '../utils/pagination.js';
import { isPermissionModule, PermissionAction, PermissionModule, principalCan } from '../utils/permissions.js';

interface ScopeInput {
  module: string;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

/** Account administration is for signed-in people only; a key can never be granted these. */
const MODULES_KEYS_CANNOT_HOLD: ReadonlySet<string> = new Set(['users', 'roles', 'apiKeys']);

const ACTIONS: [keyof Omit<ScopeInput, 'module'>, PermissionAction][] = [
  ['canView', 'view'],
  ['canAdd', 'add'],
  ['canEdit', 'edit'],
  ['canDelete', 'delete'],
];

const LIST: ListConfig = {
  searchFields: ['name', 'keyPrefix'],
  sortFields: { id: 'id', name: 'name', status: 'status', lastUsedAt: 'lastUsedAt', createdAt: 'createdAt' },
  defaultSort: { field: 'id', order: 'desc' },
  filters: { status: filter.equals('status') },
};

/** Never includes keyHash. */
const SAFE_FIELDS = { id: true, name: true, keyPrefix: true, status: true, scopes: true, lastUsedAt: true, revokedAt: true, createdAt: true, createdById: true } as const;

async function withCreatorNames(rows: any[]) {
  const ids = [...new Set(rows.map((row) => row.createdById).filter((id): id is number => typeof id === 'number'))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((user) => [user.id, user.name]));
  return rows.map(({ createdById, ...row }) => ({ ...row, scopes: Array.isArray(row.scopes) ? row.scopes : [], createdByName: names.get(createdById) }));
}

/**
 * Least privilege: only grants that do something are stored, only known
 * modules are accepted, and the creator cannot hand a key more than they
 * themselves may do.
 */
function normalizeScopes(scopes: ScopeInput[], creator: Principal): ScopeInput[] {
  const result: ScopeInput[] = [];
  for (const scope of scopes) {
    if (!isPermissionModule(scope.module) || MODULES_KEYS_CANNOT_HOLD.has(scope.module)) throw AppError.from(ErrorCode.APK_INVALID_SCOPE, 400);
    if (result.some((existing) => existing.module === scope.module)) throw AppError.from(ErrorCode.APK_INVALID_SCOPE, 400);
    for (const [flag, action] of ACTIONS) {
      if (scope[flag] && !principalCan(creator, scope.module as PermissionModule, action)) throw AppError.from(ErrorCode.APK_SCOPE_EXCEEDS_CREATOR, 403);
    }
    if (ACTIONS.some(([flag]) => scope[flag])) {
      result.push({ module: scope.module, canView: scope.canView, canAdd: scope.canAdd, canEdit: scope.canEdit, canDelete: scope.canDelete });
    }
  }
  if (result.length === 0) throw AppError.from(ErrorCode.APK_NO_SCOPES, 400);
  return result;
}

export const apiKeysService = {
  async list(query: ListQuery) {
    try {
      const page = await paginate(prisma.apiKey, query, LIST, { extra: { select: SAFE_FIELDS } });
      return { items: await withCreatorNames(page.items), pagination: page.pagination };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.APK_FETCH_FAILED, 500, error);
    }
  },

  /** Returns the full key exactly once; only its SHA-256 hash and a short prefix are stored. */
  async create(input: { name: string; scopes: ScopeInput[] }, creator: Principal) {
    const scopes = normalizeScopes(input.scopes, creator);
    const { plaintext, keyPrefix, keyHash } = generateApiKey();
    try {
      const row = await prisma.apiKey.create({
        data: { companyId: currentCompanyId(), name: input.name, keyPrefix, keyHash, scopes: scopes as object[], createdById: creator.userId },
        select: SAFE_FIELDS,
      });
      const [apiKey] = await withCreatorNames([row]);
      return { apiKey, plaintextKey: plaintext };
    } catch (error) {
      throw AppError.from(ErrorCode.APK_CREATE_FAILED, 500, error);
    }
  },

  /** Revocation is permanent and takes effect on the key's next request. The row is kept for the audit trail. */
  async revoke(id: number) {
    const existing = await prisma.apiKey.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existing) throw AppError.from(ErrorCode.APK_NOT_FOUND, 404);
    try {
      const row =
        existing.status === 'REVOKED'
          ? await prisma.apiKey.findUniqueOrThrow({ where: { id }, select: SAFE_FIELDS })
          : await prisma.apiKey.update({ where: { id }, data: { status: 'REVOKED', revokedAt: new Date() }, select: SAFE_FIELDS });
      return (await withCreatorNames([row]))[0];
    } catch (error) {
      throw AppError.from(ErrorCode.APK_REVOKE_FAILED, 500, error);
    }
  },
};
