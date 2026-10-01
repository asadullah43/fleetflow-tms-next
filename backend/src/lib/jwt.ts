import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set (see backend/.env.example)');
}

/** Tokens are always HS256-signed with JWT_SECRET; verification accepts nothing else. */
const ALGORITHM = 'HS256' as const;

export interface JwtPayload {
  sub: number;
  email: string;
  roleId: number | null;
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { algorithm: ALGORITHM, expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

/**
 * Verifies signature, algorithm and expiry, then checks the payload has
 * the shape this app signs — a validly signed token with an unexpected
 * shape is rejected rather than trusted.
 */
export function verifyJwt(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET as string, { algorithms: [ALGORITHM] });
  if (typeof decoded !== 'object' || decoded === null || typeof decoded.sub !== 'number') {
    throw new Error('Malformed token payload');
  }
  const { sub, email, roleId } = decoded as Record<string, unknown>;
  return {
    sub: sub as number,
    email: typeof email === 'string' ? email : '',
    roleId: typeof roleId === 'number' ? roleId : null,
  };
}
