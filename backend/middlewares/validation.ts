import type { ZodTypeAny } from 'zod';
import { AppError } from '../classes/app-error.js';
import { ErrorCode } from '../global_config/error-codes.js';
import type { Middleware } from './request-context.js';

/**
 * Validates the request against `schema` and replaces `ctx.input` with
 * the parsed result (unknown fields dropped, defaults applied), so
 * controllers and services only ever see fields the schema allows.
 */
export function validate(schema: ZodTypeAny): Middleware {
  return async (ctx, next) => {
    const result = schema.safeParse(ctx.request);
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue.path.join('.');
      throw AppError.from(ErrorCode.SYS_VALIDATION_ERROR, 400, undefined, field ? `Invalid value for "${field}": ${issue.message}.` : `Invalid request: ${issue.message}.`);
    }
    ctx.input = result.data;
    return next();
  };
}
