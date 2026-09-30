import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set (see backend/.env.example)');
}

export interface JwtPayload {
  sub: number;
  email: string;
  roleId: number | null;
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET as string) as unknown as JwtPayload;
}
