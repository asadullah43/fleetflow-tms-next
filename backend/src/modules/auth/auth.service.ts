import * as bcrypt from 'bcrypt';
import { prisma } from '../../lib/prisma.js';
import { signJwt } from '../../lib/jwt.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

const SAFE_USER_FIELDS = {
  id: true,
  name: true,
  email: true,
  username: true,
  roleId: true,
  roleRef: { select: { id: true, name: true } },
  status: true,
  language: true,
} as const;

function mapUserProfile(user: {
  id: number;
  name: string;
  email: string;
  roleId: number | null;
  roleRef?: { id: number; name: string } | null;
  language: string;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.roleRef?.name ?? undefined,
    roleId: user.roleId ?? undefined,
    language: user.language,
  };
}

/**
 * Direct port of the legacy AuthService (backend/src/auth/auth.service.ts
 * in the NestJS app) — same bcrypt check, same AppError codes, same JWT
 * payload shape. Only the transport changed (gRPC handlers call these
 * instead of Nest controller methods).
 */
export const authService = {
  async login(username: string, password: string, language?: string) {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { roleRef: true },
    });

    if (!user) {
      throw new AppError({
        errorCode: ErrorCode.AUTH_LOGIN_FAILED.code,
        errorFilter: ErrorCode.AUTH_LOGIN_FAILED.filter,
        errorDescription: ErrorCode.AUTH_LOGIN_FAILED.description,
        statusCode: 401,
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError({
        errorCode: ErrorCode.AUTH_ACCOUNT_INACTIVE.code,
        errorFilter: ErrorCode.AUTH_ACCOUNT_INACTIVE.filter,
        errorDescription: ErrorCode.AUTH_ACCOUNT_INACTIVE.description,
        statusCode: 401,
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new AppError({
        errorCode: ErrorCode.AUTH_LOGIN_FAILED.code,
        errorFilter: ErrorCode.AUTH_LOGIN_FAILED.filter,
        errorDescription: ErrorCode.AUTH_LOGIN_FAILED.description,
        statusCode: 401,
      });
    }

    const preferredLanguage = language ?? user.language ?? 'en';
    if (language && language !== user.language) {
      await prisma.user.update({ where: { id: user.id }, data: { language } });
    }

    const accessToken = signJwt({ sub: user.id, email: user.email, roleId: user.roleId ?? null });

    return {
      accessToken,
      user: mapUserProfile({ ...user, language: preferredLanguage }),
    };
  },

  async getMe(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: SAFE_USER_FIELDS,
    });

    if (!user) {
      throw new AppError({
        errorCode: ErrorCode.USR_NOT_FOUND.code,
        errorFilter: ErrorCode.USR_NOT_FOUND.filter,
        errorDescription: ErrorCode.USR_NOT_FOUND.description,
        statusCode: 404,
      });
    }

    return mapUserProfile(user);
  },

  async updateLanguage(userId: number, language: string) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { language },
        select: SAFE_USER_FIELDS,
      });
      return mapUserProfile(user);
    } catch (error) {
      throw new AppError({
        errorCode: ErrorCode.USR_LANGUAGE_UPDATE_FAILED.code,
        errorFilter: ErrorCode.USR_LANGUAGE_UPDATE_FAILED.filter,
        errorDescription: ErrorCode.USR_LANGUAGE_UPDATE_FAILED.description,
        statusCode: 500,
        cause: error as Error,
      });
    }
  },

  async getPermissionsForRole(roleId: number | null) {
    if (!roleId) return [];
    const permissions = await prisma.permission.findMany({ where: { roleId } });
    type PermissionRow = { module: string; canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean };
    return permissions.map((p: PermissionRow) => ({
      module: p.module,
      canView: p.canView,
      canAdd: p.canAdd,
      canEdit: p.canEdit,
      canDelete: p.canDelete,
    }));
  },
};
