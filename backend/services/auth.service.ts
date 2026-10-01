import crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../_core_app_connectivities/prisma.js';
import { runUnscoped, runWithTenant } from '../_core_app_connectivities/tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { config } from '../global_config/index.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { rateLimitError } from '../middlewares/rate-limit.js';
import { signJwt } from '../utils/jwt.js';
import { isSupportedLanguage } from '../utils/language.js';
import { effectivePermissions } from '../utils/permissions.js';
import { RateLimiter } from '../utils/rate-limiter.js';

const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  roleId: true,
  language: true,
  companyId: true,
  roleRef: { select: { id: true, name: true } },
  company: { select: { name: true } },
} as const;

/**
 * bcrypt hash of a random string, compared against when the username
 * doesn't exist so a miss costs the same time as a wrong password (no
 * username enumeration by response timing).
 */
const DUMMY_HASH = bcrypt.hashSync(crypto.randomUUID(), config.auth.bcryptRounds);

/** Counts *failed* sign-ins per username; a successful sign-in clears the count. */
const failedLogins = new RateLimiter(config.rateLimit.login);
const throttleKey = (username: string) => username.trim().toLowerCase();

interface ProfileRow {
  id: number;
  name: string;
  email: string;
  roleId: number | null;
  language: string;
  companyId: number;
  roleRef?: { id: number; name: string } | null;
  company?: { name: string } | null;
}

function mapUserProfile(user: ProfileRow) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.roleRef?.name ?? undefined,
    roleId: user.roleId ?? undefined,
    language: user.language,
    companyId: user.companyId,
    companyName: user.company?.name ?? '',
  };
}

/** The moment a freshly signed token stops being accepted, read back from the token itself. */
function expiryOf(token: string): string {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  return decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : '';
}

export const authService = {
  /**
   * Username + password sign-in. The account-status checks come after the
   * password check so a wrong password never reveals whether an account
   * exists or is deactivated. Repeated failures block the username for a
   * while (config.rateLimit.login).
   */
  async login(username: string, password: string, language?: string) {
    const key = throttleKey(username);
    const blocked = failedLogins.peek(key);
    if (!blocked.allowed) throw rateLimitError('USER', blocked, ErrorCode.AUTH_TOO_MANY_ATTEMPTS);

    // Usernames are unique across all companies, and the company is not known yet: the one unscoped lookup.
    const user = await runUnscoped(() =>
      prisma.user.findUnique({
        where: { username },
        select: { ...PROFILE_SELECT, passwordHash: true, status: true, company: { select: { name: true, status: true } } },
      }),
    );

    const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordMatches) {
      const result = failedLogins.consume(key);
      if (!result.allowed) throw rateLimitError('USER', result, ErrorCode.AUTH_TOO_MANY_ATTEMPTS);
      throw AppError.from(ErrorCode.AUTH_LOGIN_FAILED, 401);
    }

    if (user.status !== 'ACTIVE') throw AppError.from(ErrorCode.AUTH_ACCOUNT_INACTIVE, 401);
    if (user.company.status !== 'ACTIVE') throw AppError.from(ErrorCode.AUTH_COMPANY_INACTIVE, 401);
    failedLogins.reset(key);

    const requested = isSupportedLanguage(language) ? language : undefined;
    const preferredLanguage = requested ?? user.language ?? 'en';
    if (requested && requested !== user.language) {
      await runWithTenant(user.companyId, () => prisma.user.update({ where: { id: user.id }, data: { language: requested } }));
    }

    const accessToken = signJwt({ sub: user.id, email: user.email, roleId: user.roleId ?? null, companyId: user.companyId });
    return { accessToken, expiresAt: expiryOf(accessToken), user: mapUserProfile({ ...user, language: preferredLanguage }) };
  },

  async getMe(userId: number) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
    if (!user) throw AppError.from(ErrorCode.USR_NOT_FOUND, 404);
    return mapUserProfile(user);
  },

  async updateLanguage(userId: number, language: string) {
    try {
      const user = await prisma.user.update({ where: { id: userId }, data: { language }, select: PROFILE_SELECT });
      return mapUserProfile(user);
    } catch (error) {
      throw AppError.from(ErrorCode.USR_LANGUAGE_UPDATE_FAILED, 500, error);
    }
  },
};

/** The caller's effective permission matrix (ADMIN: everything) — drives which pages and buttons the UI shows. */
export function permissionsOf(principal: { roleName: string | null; permissions: Parameters<typeof effectivePermissions>[1] }) {
  return { permissions: effectivePermissions(principal.roleName, principal.permissions) };
}
