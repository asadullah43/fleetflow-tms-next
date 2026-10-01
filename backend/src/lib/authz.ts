import * as grpc from '@grpc/grpc-js';
import { prisma } from './prisma.js';
import { requireAuth } from './grpc-auth.js';
import { AppError } from '../common/errors/app-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { isAllowed, PermissionAction, PermissionModule } from '../common/auth/permissions.js';

/**
 * Who may call an RPC:
 * - `public`: no token needed (login, login-screen branding).
 * - `authenticated`: any signed-in, active user (own profile, shared lookup lists).
 * - a module + action: checked against the caller's role permission matrix.
 */
export type Access = 'public' | 'authenticated' | { module: PermissionModule; action: PermissionAction };

export interface Principal {
  userId: number;
  roleId: number | null;
}

/**
 * Authenticates the call and enforces `access`. Every non-public call
 * re-reads the user (one indexed lookup), so deactivating an account or
 * changing its role takes effect on the next request rather than when
 * the JWT eventually expires.
 */
export async function authorize(call: grpc.ServerUnaryCall<unknown, unknown>, access: Access): Promise<Principal | null> {
  if (access === 'public') return null;

  const token = requireAuth(call);
  const module = access === 'authenticated' ? null : access.module;

  const user = await prisma.user.findUnique({
    where: { id: token.sub },
    select: {
      id: true,
      status: true,
      role: true,
      roleId: true,
      roleRef: {
        select: {
          name: true,
          permissions: module
            ? { where: { module }, select: { canView: true, canAdd: true, canEdit: true, canDelete: true } }
            : false,
        },
      },
    },
  });

  // Deleted since the token was issued: treat like any other dead session.
  if (!user) throw AppError.from(ErrorCode.AUTH_TOKEN_INVALID, 401);
  if (user.status !== 'ACTIVE') throw AppError.from(ErrorCode.AUTH_ACCOUNT_INACTIVE, 401);

  if (access !== 'authenticated') {
    const roleName = user.roleRef?.name ?? (user.roleId === null ? user.role : null);
    const permission = user.roleRef?.permissions?.[0] ?? null;
    if (!isAllowed({ roleName, permission }, access.action)) {
      throw AppError.from(ErrorCode.AUTH_PERMISSION_DENIED, 403);
    }
  }

  return { userId: user.id, roleId: user.roleId };
}
