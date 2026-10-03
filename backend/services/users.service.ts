import { cachedRead } from '../_core_app_connectivities/cache.js';
import * as bcrypt from 'bcrypt';
import { prisma } from '../_core_app_connectivities/prisma.js';
import { currentCompanyId, runUnscoped } from '../_core_app_connectivities/tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { config } from '../global_config/index.js';
import { ErrorCode } from '../global_config/error-codes.js';
import type { ListQuery } from '../models/api-response.js';
import { filter, ListConfig, paginate } from '../utils/pagination.js';
import { isAdminRole } from '../utils/permissions.js';

/** Never includes passwordHash. */
const SAFE_FIELDS = {
  id: true,
  name: true,
  email: true,
  username: true,
  role: true,
  roleId: true,
  language: true,
  status: true,
  roleRef: { select: { name: true } },
} as const;

const LIST: ListConfig = {
  searchFields: ['name', 'email', 'username', 'roleRef.name'],
  sortFields: { id: 'id', name: 'name', email: 'email', status: 'status' },
  defaultSort: { field: 'id', order: 'desc' },
  filters: { status: filter.equals('status'), roleId: filter.id('roleId') },
};

function mapUser(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    username: row.username ?? undefined,
    role: row.role,
    roleId: row.roleId ?? undefined,
    language: row.language,
    status: row.status,
    roleName: row.roleRef?.name,
  };
}

interface UserInput {
  name?: string;
  email?: string;
  username?: string;
  password?: string;
  role?: string;
  roleId?: number;
  language?: string;
  status?: string;
}

/**
 * Emails and usernames identify a login, so they are unique across ALL
 * companies — the only cross-company check in user management. It only
 * answers "taken or not"; nothing about the other account is revealed.
 */
async function assertLoginNamesFree(input: UserInput, exceptUserId?: number): Promise<void> {
  const not = exceptUserId ? { NOT: { id: exceptUserId } } : {};
  // Both lookups at once, judged in the original order (email first), so the outcome is the same as one after the other.
  const [email, username] = await Promise.allSettled([
    input.email ? runUnscoped(() => prisma.user.count({ where: { email: input.email, ...not } })) : 0,
    input.username ? runUnscoped(() => prisma.user.count({ where: { username: input.username, ...not } })) : 0,
  ]);
  if (email.status === 'rejected') throw email.reason;
  if (email.value) throw AppError.from(ErrorCode.USR_DUPLICATE_EMAIL, 400);
  if (username.status === 'rejected') throw username.reason;
  if (username.value) throw AppError.from(ErrorCode.USR_DUPLICATE_USERNAME, 400);
}

/** Whether a user (as stored) is an administrator: through their role, or — with no role — the legacy `role` text (as sign-in decides). */
const isAdminUser = (user: { roleId?: number | null; roleName?: string | null; role?: string | null }) => (user.roleId ? isAdminRole(user.roleName) : isAdminRole(user.role));

/**
 * ADMIN bypasses the whole permission matrix, so administrator accounts
 * are for administrators to manage: someone who may only manage users
 * must not be able to create one, promote anyone (themselves included)
 * to it, or change an administrator's account — resetting an admin's
 * password would be taking it over.
 */
async function assertMayManage(input: Pick<UserInput, 'role' | 'roleId'>, actingIsAdmin: boolean, current?: { roleId?: number | null; roleName?: string | null; role?: string | null }): Promise<void> {
  if (actingIsAdmin) return;
  if (current && isAdminUser(current)) throw AppError.from(ErrorCode.USR_ADMIN_ONLY, 403);
  const roleId = input.roleId !== undefined ? input.roleId : (current?.roleId ?? null);
  const roleName = roleId ? (await prisma.role.findUnique({ where: { id: roleId }, select: { name: true } }))?.name : null;
  if (isAdminUser({ roleId, roleName, role: input.role || current?.role })) throw AppError.from(ErrorCode.USR_ADMIN_ONLY, 403);
}

function assertPasswordLength(password: string | undefined): void {
  if (password !== undefined && password !== '' && password.length < config.auth.minPasswordLength) {
    throw AppError.from(ErrorCode.USR_PASSWORD_TOO_SHORT, 400);
  }
}

const hashPassword = (password: string) => bcrypt.hash(password, config.auth.bcryptRounds);

export const usersService = {
  async list(query: ListQuery) {
    try {
      return await cachedRead('User.list', { query }, config.cache.listTtlSeconds, () => paginate(prisma.user, query, LIST, { extra: { select: SAFE_FIELDS }, map: mapUser }));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.USR_FETCH_FAILED, 500, error);
    }
  },

  async findOne(id: number) {
    const row = await prisma.user.findUnique({ where: { id }, select: SAFE_FIELDS });
    if (!row) throw AppError.from(ErrorCode.USR_NOT_FOUND, 404);
    return mapUser(row);
  },

  async create(input: UserInput & { name: string; email: string; password: string }, actingIsAdmin = false) {
    if (input.password.length < config.auth.minPasswordLength) throw AppError.from(ErrorCode.USR_PASSWORD_TOO_SHORT, 400);
    await assertMayManage(input, actingIsAdmin);
    await assertLoginNamesFree(input);
    try {
      const row = await prisma.user.create({
        data: {
          companyId: currentCompanyId(),
          name: input.name,
          email: input.email,
          username: input.username || undefined,
          passwordHash: await hashPassword(input.password),
          role: input.role || 'DISPATCHER',
          roleId: input.roleId,
          language: input.language ?? 'en',
          status: input.status || 'ACTIVE',
        },
        select: SAFE_FIELDS,
      });
      return mapUser(row);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.USR_CREATE_FAILED, 500, error);
    }
  },

  /** `actingUserId`: the caller — an account can't deactivate itself (avoids locking the last admin out). */
  async update(id: number, input: UserInput, actingUserId: number | null, actingIsAdmin = false) {
    const current = await this.findOne(id);
    await assertMayManage(input, actingIsAdmin, current);
    if (actingUserId === id && input.status && input.status !== 'ACTIVE') throw AppError.from(ErrorCode.USR_CANNOT_REMOVE_SELF, 400);
    assertPasswordLength(input.password);
    await assertLoginNamesFree(input, id);
    try {
      const row = await prisma.user.update({
        where: { id },
        data: {
          name: input.name || undefined,
          email: input.email || undefined,
          username: input.username || undefined,
          passwordHash: input.password ? await hashPassword(input.password) : undefined,
          role: input.role || undefined,
          roleId: input.roleId,
          language: input.language,
          status: input.status || undefined,
        },
        select: SAFE_FIELDS,
      });
      return mapUser(row);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.USR_UPDATE_FAILED, 500, error);
    }
  },

  async remove(id: number, actingUserId: number | null, actingIsAdmin = false) {
    if (actingUserId === id) throw AppError.from(ErrorCode.USR_CANNOT_REMOVE_SELF, 400);
    const current = await this.findOne(id);
    if (!actingIsAdmin && isAdminUser(current)) throw AppError.from(ErrorCode.USR_ADMIN_ONLY, 403);
    try {
      await prisma.user.delete({ where: { id } });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2003' || code === 'P2014') throw AppError.from(ErrorCode.SYS_RECORD_IN_USE, 400, error);
      throw AppError.from(ErrorCode.USR_DELETE_FAILED, 500, error);
    }
  },
};
