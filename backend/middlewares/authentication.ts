/**
 * Centralized authentication. One logical API, two credentials:
 *   - JWT:      metadata `authorization: Bearer <token>` (interactive users)
 *   - API key:  metadata `x-api-key: <key>`              (integrations)
 *
 * Either way the result is a Principal whose companyId comes from the
 * stored credential, and the rest of the request runs inside that
 * company's tenant context. The user / key is re-read on every call, so
 * deactivating an account, changing a role or revoking a key takes
 * effect on the next request.
 */
import { prisma } from '../_core_app_connectivities/prisma.js';
import { runUnscoped, runWithTenant } from '../_core_app_connectivities/tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { config } from '../global_config/index.js';
import { ErrorCode } from '../global_config/error-codes.js';
import type { Principal } from '../models/auth-context.js';
import { hashApiKey } from '../utils/api-key.js';
import { verifyJwt } from '../utils/jwt.js';
import { PermissionFlags, isPermissionModule } from '../utils/permissions.js';
import { enforcePrincipalRateLimit } from './rate-limit.js';
import { header, Middleware, RequestContext } from './request-context.js';

const FLAG_SELECT = { module: true, canView: true, canAdd: true, canEdit: true, canDelete: true } as const;
const LAST_USED_WRITE_INTERVAL_MS = 60_000;

async function principalFromJwt(token: string): Promise<Principal> {
  let userId: number;
  try {
    userId = verifyJwt(token).sub;
  } catch {
    // Expired (after the session lifetime), tampered, wrong algorithm or wrong shape — all mean "sign in again".
    throw AppError.from(ErrorCode.AUTH_TOKEN_INVALID, 401);
  }

  const user = await runUnscoped(() =>
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        role: true,
        roleId: true,
        companyId: true,
        company: { select: { status: true } },
        roleRef: { select: { name: true, permissions: { select: FLAG_SELECT } } },
      },
    }),
  );

  // Deleted since the token was issued: treat like any other dead session.
  if (!user) throw AppError.from(ErrorCode.AUTH_TOKEN_INVALID, 401);
  if (user.status !== 'ACTIVE') throw AppError.from(ErrorCode.AUTH_ACCOUNT_INACTIVE, 401);
  if (user.company.status !== 'ACTIVE') throw AppError.from(ErrorCode.AUTH_COMPANY_INACTIVE, 401);

  return {
    authMethod: 'JWT',
    companyId: user.companyId,
    userId: user.id,
    apiKeyId: null,
    // Users without a roleId fall back to the legacy `role` string column.
    roleName: user.roleRef?.name ?? (user.roleId === null ? user.role : null),
    permissions: user.roleRef?.permissions ?? [],
  };
}

function parseScopes(raw: unknown): Principal['permissions'] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is { module: string } & Partial<PermissionFlags> => !!row && typeof row === 'object' && isPermissionModule((row as { module?: unknown }).module))
    .map((row) => ({
      module: row.module,
      canView: row.canView === true,
      canAdd: row.canAdd === true,
      canEdit: row.canEdit === true,
      canDelete: row.canDelete === true,
    }));
}

async function principalFromApiKey(plaintext: string): Promise<Principal> {
  const key = await runUnscoped(() =>
    prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(plaintext) },
      select: { id: true, companyId: true, status: true, scopes: true, lastUsedAt: true, company: { select: { status: true } } },
    }),
  );
  if (!key || key.status !== 'ACTIVE') throw AppError.from(ErrorCode.AUTH_API_KEY_INVALID, 401);
  if (key.company.status !== 'ACTIVE') throw AppError.from(ErrorCode.AUTH_COMPANY_INACTIVE, 401);

  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS) {
    // Best-effort audit stamp; never fails the request.
    void runUnscoped(() => prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })).catch(() => undefined);
  }

  return {
    authMethod: 'API_KEY',
    companyId: key.companyId,
    userId: null,
    apiKeyId: key.id,
    // An API key never acts as a user or as ADMIN: it has exactly its scopes.
    roleName: null,
    permissions: parseScopes(key.scopes),
  };
}

async function resolvePrincipal(ctx: RequestContext): Promise<Principal> {
  const apiKey = header(ctx.metadata, config.auth.apiKeyHeader);
  if (apiKey) return principalFromApiKey(apiKey.trim());

  const authorization = header(ctx.metadata, 'authorization');
  if (authorization?.startsWith('Bearer ')) return principalFromJwt(authorization.slice('Bearer '.length));

  throw AppError.from(ErrorCode.AUTH_TOKEN_MISSING, 401);
}

/** Requires a valid JWT or API key, applies the per-caller rate limit, then runs the rest of the chain in the caller's tenant. */
export const authenticate: Middleware = async (ctx, next) => {
  ctx.principal = await resolvePrincipal(ctx);
  enforcePrincipalRateLimit(ctx);
  return runWithTenant(ctx.principal.companyId, next);
};

/**
 * For routes that work with or without a session (company branding):
 * a caller who sends credentials is authenticated normally and sees
 * their own company; an anonymous caller gets the default company.
 */
export const authenticateIfPresent: Middleware = (ctx, next) => {
  const hasCredentials = !!header(ctx.metadata, config.auth.apiKeyHeader) || !!header(ctx.metadata, 'authorization');
  return hasCredentials ? authenticate(ctx, next) : runWithTenant(config.tenancy.defaultCompanyId, next);
};
