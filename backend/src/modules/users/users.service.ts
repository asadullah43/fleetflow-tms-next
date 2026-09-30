import * as bcrypt from 'bcrypt';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

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

function fail(code: { code: string; filter: any; description: string }, statusCode: number, cause?: unknown): never {
  throw new AppError({ errorCode: code.code, errorFilter: code.filter, errorDescription: code.description, statusCode, cause: cause as Error });
}

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

interface CreateUserDto {
  name: string;
  email: string;
  username?: string;
  password: string;
  role?: string;
  roleId?: number;
  language?: string;
  status?: string;
}

interface UpdateUserDto {
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
 * Direct port of the legacy UsersService: SAFE_FIELDS projection (never
 * returns passwordHash), duplicate email/username checks, bcrypt hashing
 * on create and on password change.
 */
export const usersService = {
  async findAll() {
    const rows = await prisma.user.findMany({ select: SAFE_FIELDS, orderBy: { id: 'desc' } });
    return rows.map(mapUser);
  },

  async findOne(id: number) {
    const row = await prisma.user.findUnique({ where: { id }, select: SAFE_FIELDS });
    if (!row) fail(ErrorCode.USR_NOT_FOUND, 404);
    return mapUser(row);
  },

  async create(dto: CreateUserDto) {
    const dupEmail = await prisma.user.findUnique({ where: { email: dto.email } });
    if (dupEmail) fail(ErrorCode.USR_DUPLICATE_EMAIL, 400);
    if (dto.username) {
      const dupUsername = await prisma.user.findUnique({ where: { username: dto.username } });
      if (dupUsername) fail(ErrorCode.USR_DUPLICATE_USERNAME, 400);
    }
    try {
      const passwordHash = await bcrypt.hash(dto.password, 10);
      const row = await prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          username: dto.username,
          passwordHash,
          role: dto.role ?? 'DISPATCHER',
          roleId: dto.roleId,
          language: dto.language ?? 'en',
          status: dto.status ?? 'ACTIVE',
        },
        select: SAFE_FIELDS,
      });
      return mapUser(row);
    } catch (error) {
      fail(ErrorCode.USR_CREATE_FAILED, 500, error);
    }
  },

  async update(id: number, dto: UpdateUserDto) {
    await this.findOne(id);
    if (dto.email) {
      const dupEmail = await prisma.user.findFirst({ where: { email: dto.email, NOT: { id } } });
      if (dupEmail) fail(ErrorCode.USR_DUPLICATE_EMAIL, 400);
    }
    if (dto.username) {
      const dupUsername = await prisma.user.findFirst({ where: { username: dto.username, NOT: { id } } });
      if (dupUsername) fail(ErrorCode.USR_DUPLICATE_USERNAME, 400);
    }
    try {
      const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;
      const row = await prisma.user.update({
        where: { id },
        data: {
          name: dto.name,
          email: dto.email,
          username: dto.username,
          passwordHash,
          role: dto.role,
          roleId: dto.roleId,
          language: dto.language,
          status: dto.status,
        },
        select: SAFE_FIELDS,
      });
      return mapUser(row);
    } catch (error) {
      fail(ErrorCode.USR_UPDATE_FAILED, 500, error);
    }
  },

  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.user.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.USR_DELETE_FAILED, 500, error);
    }
  },
};
