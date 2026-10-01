import crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { prisma } from '../../lib/prisma.js';
import { signJwt } from '../../lib/jwt.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { isSupportedLanguage } from '../../common/localization/language.util.js';
import { effectivePermissions } from '../../common/auth/permissions.js';
import { loginThrottle } from './login-throttle.js';

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

/**
 * bcrypt hash of a random string, compared against when the username
 * doesn't exist so a miss costs the same time as a wrong password (no
 * username enumeration by response timing).
 */
const DUMMY_HASH = bcrypt.hashSync(crypto.randomUUID(), 10);

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
 * Port of the legacy AuthService — same bcrypt check, same AppError
 * codes, same JWT payload shape — plus a failed-attempt throttle, and
 * the account-status check moved after the password check so a wrong
 * password never reveals whether an account exists or is deactivated.
 */
export const authService = {
  async login(username: string, password: string, language?: string) {
    if (!username || !password) throw AppError.from(ErrorCode.AUTH_LOGIN_FAILED, 401);
    if (loginThrottle.isBlocked(username)) throw AppError.from(ErrorCode.AUTH_TOO_MANY_ATTEMPTS, 429);

    const user = await prisma.user.findUnique({
      where: { username },
      include: { roleRef: true },
    });

    const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordMatches) {
      loginThrottle.recordFailure(username);
      throw AppError.from(ErrorCode.AUTH_LOGIN_FAILED, 401);
    }

    if (user.status !== 'ACTIVE') throw AppError.from(ErrorCode.AUTH_ACCOUNT_INACTIVE, 401);
    loginThrottle.recordSuccess(username);

    const requested = isSupportedLanguage(language) ? language : undefined;
    const preferredLanguage = requested ?? user.language ?? 'en';
    if (requested && requested !== user.language) {
      await prisma.user.update({ where: { id: user.id }, data: { language: requested } });
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
    if (!user) throw AppError.from(ErrorCode.USR_NOT_FOUND, 404);
    return mapUserProfile(user);
  },

  async updateLanguage(userId: number, language: string) {
    if (!isSupportedLanguage(language)) throw AppError.from(ErrorCode.SYS_VALIDATION_ERROR, 400);
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { language },
        select: SAFE_USER_FIELDS,
      });
      return mapUserProfile(user);
    } catch (error) {
      throw AppError.from(ErrorCode.USR_LANGUAGE_UPDATE_FAILED, 500, error);
    }
  },

  /** The caller's effective permission matrix (ADMIN: everything) — drives which pages/buttons the UI shows. */
  async getMyPermissions(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, roleId: true, roleRef: { select: { name: true, permissions: true } } },
    });
    if (!user) return [];
    const roleName = user.roleRef?.name ?? (user.roleId === null ? user.role : null);
    return effectivePermissions(roleName, user.roleRef?.permissions ?? []);
  },
};
