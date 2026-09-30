import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { authGrpcImpl } from './modules/auth/auth.grpc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_DIR = path.resolve(__dirname, '../../proto');
const PORT = process.env.GRPC_PORT ?? '50051';

const packageDefinition = protoLoader.loadSync(
  ['auth.proto', 'common.proto'],
  {
    keepCase: false, // camelCase field names on the JS side (canView, roleId, ...)
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [PROTO_DIR],
  },
);

const proto = grpc.loadPackageDefinition(packageDefinition) as any;

const server = new grpc.Server();

server.addService(proto.fleetflow.auth.AuthService.service, authGrpcImpl);

// Each further module (trucks, drivers, trips, invoices, ...) registers
// its own service the same way as it's ported — see proto/*.proto and
// backend/src/modules/*/*.grpc.ts.

server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
  if (err) {
    console.error('Failed to start gRPC server:', err);
    process.exit(1);
  }
  console.log(`FleetFlow gRPC server listening on 0.0.0.0:${boundPort}`);
});
