import { PrismaClient } from '../generated/prisma/index.js';

// Single shared Prisma client for the whole process, same pattern as the
// legacy NestJS PrismaService (just without Nest's DI wiring it in).
export const prisma = new PrismaClient();
