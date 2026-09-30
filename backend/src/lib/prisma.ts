// The "prisma-client" generator (schema.prisma's `generator client` block)
// outputs client.ts as its entry point, not index.js like the older
// "prisma-client-js" generator did.
import { PrismaClient } from '../generated/prisma/client.js';

// Single shared Prisma client for the whole process, same pattern as the
// legacy NestJS PrismaService (just without Nest's DI wiring it in).
export const prisma = new PrismaClient();
