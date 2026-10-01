import jwt from 'jsonwebtoken';
import { config } from '../global_config/index.js';

/** Tokens are always HS256-signed with JWT_SECRET; verification accepts nothing else. */
const ALGORITHM = 'HS256' as const;

export interface JwtPayload {
  sub: number;
  email: string;
  roleId: number | null;
  companyId: number | null;
}

/** Signs a session token that expires after config.auth.sessionDuration (12h by default) and is never refreshed. */
export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, config.auth.jwtSecret, { algorithm: ALGORITHM, expiresIn: config.auth.sessionDuration } as jwt.SignOptions);
}

/**
 * Verifies signature, algorithm and expiry, then checks the payload has
 * the shape this app signs — a validly signed token with an unexpected
 * shape is rejected rather than trusted.
 */
export function verifyJwt(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.auth.jwtSecret, { algorithms: [ALGORITHM] });
  if (typeof decoded !== 'object' || decoded === null || typeof decoded.sub !== 'number') {
    throw new Error('Malformed token payload');
  }
  const { sub, email, roleId, companyId } = decoded as Record<string, unknown>;
  return {
    sub: sub as number,
    email: typeof email === 'string' ? email : '',
    roleId: typeof roleId === 'number' ? roleId : null,
    companyId: typeof companyId === 'number' ? companyId : null,
  };
}
