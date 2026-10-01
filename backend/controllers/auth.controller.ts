import { AppError } from '../classes/app-error.js';
import { ErrorCode } from '../global_config/error-codes.js';
import type { Controller, RequestContext } from '../middlewares/request-context.js';
import { authService, permissionsOf } from '../services/auth.service.js';

/** These routes sit behind requireUserSession, so a user id is always present. */
function userId(ctx: RequestContext): number {
  const id = ctx.principal?.userId;
  if (!id) throw AppError.from(ErrorCode.AUTH_TOKEN_MISSING, 401);
  return id;
}

export const authController = {
  login: ((ctx) => authService.login(ctx.input.username, ctx.input.password, ctx.input.language)) as Controller<{ username: string; password: string; language?: string }>,
  getMe: ((ctx) => authService.getMe(userId(ctx))) as Controller,
  updateLanguage: ((ctx) => authService.updateLanguage(userId(ctx), ctx.input.language)) as Controller<{ language: string }>,
  getMyPermissions: (async (ctx) => permissionsOf(ctx.principal!)) as Controller,
};
