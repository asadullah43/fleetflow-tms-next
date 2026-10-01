import * as bcrypt from 'bcrypt';
import { prisma } from '../_core_app_connectivities/prisma.js';
import { currentCompanyId, runUnscoped } from '../_core_app_connectivities/tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { config } from '../global_config/index.js';
import { ErrorCode } from '../global_config/error-codes.js';
import type { ListQuery } from '../models/api-response.js';
import { filter, ListConfig, paginate } from '../utils/pagination.js';

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
  if (input.email) {
    const taken = await runUnscoped(() => prisma.user.count({ where: { email: input.email, ...not } }));
    if (taken) throw AppError.from(ErrorCode.USR_DUPLICATE_EMAIL, 400);
  }
  if (input.username) {
    const taken = await runUnscoped(() => prisma.user.count({ where: { username: input.username, ...not } }));
    if (taken) throw AppError.from(ErrorCode.USR_DUPLICATE_USERNAME, 400);
  }
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
      return await paginate(prisma.user, query, LIST, { extra: { select: SAFE_FIELDS }, map: mapUser });
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

  async create(input: UserInput & { name: string; email: string; password: string }) {
    if (input.password.length < config.auth.minPasswordLength) throw AppError.from(ErrorCode.USR_PASSWORD_TOO_SHORT, 400);
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
  async update(id: number, input: UserInput, actingUserId: number | null) {
    await this.findOne(id);
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

  async remove(id: number, actingUserId: number | null) {
    if (actingUserId === id) throw AppError.from(ErrorCode.USR_CANNOT_REMOVE_SELF, 400);
    await this.findOne(id);
    try {
      await prisma.user.delete({ where: { id } });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2003' || code === 'P2014') throw AppError.from(ErrorCode.SYS_RECORD_IN_USE, 400, error);
      throw AppError.from(ErrorCode.USR_DELETE_FAILED, 500, error);
    }
  },
};
