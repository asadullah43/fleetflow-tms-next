import { AppError } from '../classes/app-error.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { PermissionAction, PermissionModule, principalCan } from '../utils/permissions.js';
import type { Middleware } from './request-context.js';

/**
 * Requires the authenticated caller to hold `action` on `module` in the
 * role permission matrix (or, for an API key, in its scopes). Must come
 * after `authenticate`. This — not the frontend's hidden buttons — is the
 * security boundary.
 */
export function authorize(module: PermissionModule, action: PermissionAction): Middleware {
  return async (ctx, next) => {
    if (!ctx.principal) throw AppError.from(ErrorCode.AUTH_TOKEN_MISSING, 401);
    if (!principalCan(ctx.principal, module, action)) throw AppError.from(ErrorCode.AUTH_PERMISSION_DENIED, 403);
    return next();
  };
}

/**
 * For shared reference lists that other modules' forms pick from (trucks,
 * drivers, customers, ...): any signed-in user may read them — someone
 * allowed to record trips must be able to fill the trip form's dropdowns
 * — but an API key still needs the module's view grant (least privilege).
 */
export function authorizeLookup(module: PermissionModule): Middleware {
  return async (ctx, next) => {
    if (!ctx.principal) throw AppError.from(ErrorCode.AUTH_TOKEN_MISSING, 401);
    if (ctx.principal.authMethod !== 'JWT' && !principalCan(ctx.principal, module, 'view')) throw AppError.from(ErrorCode.AUTH_PERMISSION_DENIED, 403);
    return next();
  };
}

/** Interactive-user-only operations (own profile, managing API keys): an API key may not call them. */
export const requireUserSession: Middleware = async (ctx, next) => {
  if (!ctx.principal) throw AppError.from(ErrorCode.AUTH_TOKEN_MISSING, 401);
  if (ctx.principal.authMethod !== 'JWT') throw AppError.from(ErrorCode.AUTH_PERMISSION_DENIED, 403);
  return next();
};
