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
    /**
     * Prisma connection pool, per API process (connection_limit /
     * pool_timeout in DATABASE_URL take precedence). Prisma's own default
     * is 2 × CPU cores + 1, which silently changes with the machine: 5 on
     * a 2-vCPU container, 33 on a 16-core host. Measured with 32
     * concurrent callers on uncached lists and dashboards: 5 connections
     * queue requests (−20% throughput); 10, 13 and 17 are indistinguishable
     * (the API process's CPU is the limit by then); 30 adds nothing. 10 is
     * the smallest size on that plateau, and leaves most of Postgres's
     * default 100 connections for migrations, admin tools and a second
     * instance. Raise it only if requests are measured waiting for a
     * connection (pool_timeout errors) while the database has CPU to spare.
     */
    pool: {
      size: int('DATABASE_POOL_SIZE', 10),
      /** Seconds a query may wait for a free connection before failing. Prisma's default. */
      timeoutSeconds: int('DATABASE_POOL_TIMEOUT_SECONDS', 10),
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

  /**
   * Uploaded files (employee documents, contract PDFs). gRPC carries no
   * multipart uploads, so the backend also serves a small plain-HTTP API
   * for them on `httpPort` (POST /files, GET /files/:id); Envoy routes
   * /files/ there. The bytes live on disk under `dir` — a Docker volume
   * in production, so they survive a rebuild of the API container.
   */
  files: {
    httpPort: int('FILES_HTTP_PORT', 8081),
    /** Defaults to ./uploads next to where the backend is started (backend/uploads in development). */
    dir: path.resolve(process.env.UPLOADS_DIR || 'uploads'),
    /** Largest file accepted, in bytes. nginx's body limit for /grpc/files/ must stay above it (nginx.conf). */
    maxBytes: int('FILE_UPLOAD_MAX_BYTES', 10 * 1024 * 1024),
    /** How long an "open / download" link stays valid. Opening the file again issues a new one. */
    linkTtlSeconds: int('FILE_LINK_TTL_SECONDS', 300),
    /** An upload never attached to a record (form abandoned) is deleted after this long. */
    orphanTtlHours: int('FILE_ORPHAN_TTL_HOURS', 24),
  },

  /**
   * Redis read cache (see _core_app_connectivities/cache.ts). Off when
   * REDIS_URL is unset; when Redis is unreachable every read falls through
   * to the database. Correctness never depends on these TTLs — every write
   * invalidates immediately; the TTL only bounds how long unused entries linger.
   */
  cache: {
    url: process.env.REDIS_URL || null,
    /** Lists and dropdown options. */
    listTtlSeconds: int('CACHE_LIST_TTL_SECONDS', 300),
    /** Dashboard figures (also keyed by day, since "this month" / "today" move). */
    dashboardTtlSeconds: int('CACHE_DASHBOARD_TTL_SECONDS', 120),
    /** A Redis command slower than this counts as "Redis unavailable" and the database answers instead. */
    commandTimeoutMs: int('CACHE_COMMAND_TIMEOUT_MS', 150),
  },

  logging: {
    debug: process.env.DEBUG_LOGS_ENABLED === 'true',
  },

  seed: {
    adminPassword: process.env.SEED_ADMIN_PASSWORD,
  },
} as const;
