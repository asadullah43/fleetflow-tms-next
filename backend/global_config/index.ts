/**
 * The ONLY place environment variables are read. Everything else imports
 * `config` — no `process.env` in services, controllers, routes or
 * middlewares — so every tunable is visible (and documented) here.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see backend/.env.example)`);
  return value;
}

function int(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** proto/ sits next to backend/ in the repo and at /proto in the Docker image; PROTO_DIR overrides both. */
function resolveProtoDir(): string {
  const candidates = [process.env.PROTO_DIR, path.resolve(here, '../../proto'), path.resolve(here, '../../../proto'), '/proto'];
  const found = candidates.find((dir): dir is string => !!dir && fs.existsSync(path.join(dir, 'common.proto')));
  if (!found) throw new Error('Could not locate the proto directory (set PROTO_DIR)');
  return found;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',

  grpc: {
    port: int('GRPC_PORT', 50051),
    get protoDir() {
      return resolveProtoDir();
    },
  },

  database: {
    get url() {
      return required('DATABASE_URL');
    },
  },

  auth: {
    get jwtSecret() {
      return required('JWT_SECRET');
    },
    /**
     * Absolute session lifetime. Tokens are not refreshed, so a user must
     * sign in again this long after logging in; the backend rejects the
     * token after that regardless of what the browser does.
     */
    sessionDuration: process.env.SESSION_DURATION ?? '12h',
    apiKeyHeader: 'x-api-key',
    minPasswordLength: 8,
    bcryptRounds: 10,
  },

  tenancy: {
    /** Company whose branding the login screen shows before anyone is signed in. */
    defaultCompanyId: int('DEFAULT_COMPANY_ID', 1),
  },

  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },

  /** points per window; `blockSeconds` is how long a caller stays blocked once the limit is hit. */
  rateLimit: {
    ip: { points: int('RATE_LIMIT_IP_POINTS', 1200), windowSeconds: 60, blockSeconds: 60 },
    user: { points: int('RATE_LIMIT_USER_POINTS', 600), windowSeconds: 60, blockSeconds: 60 },
    apiKey: { points: int('RATE_LIMIT_API_KEY_POINTS', 300), windowSeconds: 60, blockSeconds: 60 },
    /** Failed sign-in attempts per username. */
    login: { points: int('RATE_LIMIT_LOGIN_POINTS', 10), windowSeconds: 15 * 60, blockSeconds: 30 * 60 },
  },

  idempotency: {
    ttlHours: int('IDEMPOTENCY_TTL_HOURS', 24),
  },

  logging: {
    debug: process.env.DEBUG_LOGS_ENABLED === 'true',
  },

  seed: {
    adminPassword: process.env.SEED_ADMIN_PASSWORD,
  },
} as const;
