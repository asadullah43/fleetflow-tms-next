import { AppError, ErrorCodeEntry } from '../classes/app-error.js';
import { config } from '../global_config/index.js';
import { ErrorCode } from '../global_config/error-codes.js';
import type { RateLimitType } from '../models/api-response.js';
import { RateLimiter, RateLimitResult } from '../utils/rate-limiter.js';
import type { Middleware, RequestContext } from './request-context.js';

const limiters = {
  ip: new RateLimiter(config.rateLimit.ip),
  user: new RateLimiter(config.rateLimit.user),
  apiKey: new RateLimiter(config.rateLimit.apiKey),
};

function waitText(seconds: number): string {
  if (seconds < 90) return `${seconds} seconds`;
  return `${Math.ceil(seconds / 60)} minutes`;
}

/** The standard RATE_LIMIT_EXCEEDED error, with the retry information the envelope carries. */
export function rateLimitError(type: RateLimitType, result: RateLimitResult, entry: ErrorCodeEntry = ErrorCode.RATE_LIMITED): AppError {
  return new AppError({
    errorCode: entry.code,
    errorFilter: entry.filter,
    errorDescription: `Too many requests. Please try again in ${waitText(result.retryAfterSeconds)}.`,
    statusCode: 429,
    rateLimit: { type, retryAfterSeconds: result.retryAfterSeconds, remainingPoints: result.remainingPoints },
  });
}

/** Applied by the router to every route, before authentication. */
export const rateLimitByIp: Middleware = async (ctx, next) => {
  const result = limiters.ip.consume(ctx.ip);
  if (!result.allowed) throw rateLimitError('IP', result);
  return next();
};

/** Called by the authentication middleware once the caller is known. */
export function enforcePrincipalRateLimit(ctx: RequestContext): void {
  const principal = ctx.principal;
  if (!principal) return;
  if (principal.authMethod === 'API_KEY') {
    const result = limiters.apiKey.consume(`key:${principal.apiKeyId}`);
    if (!result.allowed) throw rateLimitError('API_KEY', result);
  } else {
    const result = limiters.user.consume(`user:${principal.userId}`);
    if (!result.allowed) throw rateLimitError('USER', result);
  }
}
