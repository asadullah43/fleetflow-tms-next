/**
 * FleetFlow API server (gRPC). Wiring only:
 *
 *   routes/ → middlewares/ → controllers/ → services/ → data_repositories/ → Prisma
 *
 * Browsers reach it through Envoy (grpc-web); integrations may call it
 * directly. Configuration comes from global_config/, never from
 * process.env here.
 */
import * as grpc from '@grpc/grpc-js';
import { disconnectDatabase } from './_core_app_connectivities/prisma.js';
import { startBackgroundServices } from './_bg_services/index.js';
import { config } from './global_config/index.js';
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
  logger.info(`FleetFlow gRPC server listening on 0.0.0.0:${port}`, { env: config.env, sessionDuration: config.auth.sessionDuration });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutting down', { signal });
    stopBackgroundServices();
    // Let in-flight requests finish, then close the database connection.
    server.tryShutdown(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});
