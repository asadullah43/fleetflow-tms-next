/**
 * FleetFlow API server (gRPC). Wiring only:
 *
 *   routes/ → middlewares/ → controllers/ → services/ → data_repositories/ → Prisma
 *
 * Browsers reach it through Envoy (grpc-web); integrations may call it
 * directly. File upload/download is plain HTTP on its own port
 * (routes/files.http.ts), routed by Envoy under /files/. Configuration comes from global_config/, never from
 * process.env here.
 */
import * as grpc from '@grpc/grpc-js';
import { warmUpCache } from './_core_app_connectivities/cache.js';
import { disconnectDatabase } from './_core_app_connectivities/prisma.js';
import { disconnectCache } from './_core_app_connectivities/redis.js';
import { startBackgroundServices } from './_bg_services/index.js';
import { config } from './global_config/index.js';
import { startFilesHttpServer } from './routes/files.http.js';
import { registerRoutes } from './routes/index.js';
import { logger } from './utils/logger.js';

// Fail at startup, not on the first login, if the secret is missing.
void config.auth.jwtSecret;
void config.database.url;

const server = new grpc.Server();
registerRoutes(server);

server.bindAsync(`0.0.0.0:${config.grpc.port}`, grpc.ServerCredentials.createInsecure(), (error, port) => {
  if (error) {
    logger.error('failed to start gRPC server', { error });
    process.exit(1);
  }
  const stopBackgroundServices = startBackgroundServices();
  const filesServer = startFilesHttpServer();
  logger.info(`FleetFlow gRPC server listening on 0.0.0.0:${port}`, { env: config.env, sessionDuration: config.auth.sessionDuration });
  // Connect the read cache now rather than on the first request (it serves nothing until Redis answers).
  void warmUpCache().then((ready) => logger.info(config.cache.url ? (ready ? 'cache: Redis connected' : 'cache: Redis not reachable yet, reading from the database') : 'cache: off (REDIS_URL not set)'));

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutting down', { signal });
    stopBackgroundServices();
    filesServer.close();
    // Let in-flight requests finish, then close the database and cache connections.
    server.tryShutdown(() => {
      void Promise.allSettled([disconnectDatabase(), disconnectCache()]).finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});
