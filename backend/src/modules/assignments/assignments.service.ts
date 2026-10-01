import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

const INCLUDE = { truck: { select: { truckNumber: true } }, driver: { select: { name: true, nameAr: true } } } as const;

function mapOut(row: any) {
  return {
    id: row.id,
    truckId: row.truckId,
    driverId: row.driverId,
    startDate: row.startDate,
    endDate: row.endDate,
    truckNumber: row.truck?.truckNumber,
    driverName: row.driver?.name,
    driverNameAr: row.driver?.nameAr,
  };
}

/**
 * Direct port of the legacy truck<->driver assignment service: tracks
 * which driver is running which truck over a date range, with an
 * overlap check (a truck can't have two active assignments at once).
 */
/**
 * A truck can't have two assignments covering the same day — this is
 * what the legacy backend called assertNoOverlap. endDate === null
 * means open-ended (ongoing), so it overlaps anything that starts
 * before it ends or is itself still open.
 */
async function assertNoOverlap(truckId: number, startDate: Date, endDate: Date | null, excludeId?: number) {
  const overlap = await prisma.truckDriverAssignment.findFirst({
    where: {
      truckId,
      ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
      ...(endDate !== null ? { startDate: { lte: endDate } } : {}),
      OR: [{ endDate: { gte: startDate } }, { endDate: null }],
    },
  });
  if (overlap) {
    throw new AppError({
      errorCode: ErrorCode.TRK_ASSIGNMENT_OVERLAP.code,
      errorFilter: ErrorCode.TRK_ASSIGNMENT_OVERLAP.filter,
      errorDescription: ErrorCode.TRK_ASSIGNMENT_OVERLAP.description,
      statusCode: 400,
    });
  }
}

export const assignmentsService = {
  async findAll() {
    const rows = await prisma.truckDriverAssignment.findMany({ include: INCLUDE, orderBy: { id: 'desc' } });
    return rows.map(mapOut);
  },

  async findOne(id: number) {
    const row = await prisma.truckDriverAssignment.findUnique({ where: { id }, include: INCLUDE });
    if (!row) {
      throw new AppError({
        errorCode: ErrorCode.TRK_ASSIGNMENT_NOT_FOUND.code,
        errorFilter: ErrorCode.TRK_ASSIGNMENT_NOT_FOUND.filter,
        errorDescription: ErrorCode.TRK_ASSIGNMENT_NOT_FOUND.description,
        statusCode: 404,
      });
    }
    return mapOut(row);
  },

  async create(dto: { truckId: number; driverId: number; startDate: string; endDate?: string }) {
    if (dto.endDate && new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new AppError({
        errorCode: ErrorCode.TRK_ASSIGNMENT_INVALID_DATES.code,
        errorFilter: ErrorCode.TRK_ASSIGNMENT_INVALID_DATES.filter,
        errorDescription: ErrorCode.TRK_ASSIGNMENT_INVALID_DATES.description,
        statusCode: 400,
      });
    }
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    await assertNoOverlap(dto.truckId, startDate, endDate);
    try {
      const row = await prisma.truckDriverAssignment.create({
        data: {
          truckId: dto.truckId,
          driverId: dto.driverId,
          startDate,
          endDate,
        },
        include: INCLUDE,
      });
      return mapOut(row);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError({
        errorCode: ErrorCode.TRK_ASSIGNMENT_CREATE_FAILED.code,
        errorFilter: ErrorCode.TRK_ASSIGNMENT_CREATE_FAILED.filter,
        errorDescription: ErrorCode.TRK_ASSIGNMENT_CREATE_FAILED.description,
        statusCode: 500,
        cause: error as Error,
      });
    }
  },

  async update(id: number, dto: { truckId?: number; driverId?: number; startDate?: string; endDate?: string }) {
    const existing = await this.findOne(id);
    const truckId = dto.truckId ?? existing.truckId;
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date(existing.startDate);
    const endDate = dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : existing.endDate ? new Date(existing.endDate) : null;
    // Create already rejected end-before-start; update didn't, so an edit could save an impossible range.
    if (endDate && endDate < startDate) throw AppError.from(ErrorCode.TRK_ASSIGNMENT_INVALID_DATES, 400);
    await assertNoOverlap(truckId, startDate, endDate, id);
    try {
      const row = await prisma.truckDriverAssignment.update({
        where: { id },
        data: {
          truckId: dto.truckId,
          driverId: dto.driverId,
          startDate: dto.startDate ? startDate : undefined,
          endDate: dto.endDate !== undefined ? endDate : undefined,
        },
        include: INCLUDE,
      });
      return mapOut(row);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError({
        errorCode: ErrorCode.TRK_ASSIGNMENT_UPDATE_FAILED.code,
        errorFilter: ErrorCode.TRK_ASSIGNMENT_UPDATE_FAILED.filter,
        errorDescription: ErrorCode.TRK_ASSIGNMENT_UPDATE_FAILED.description,
        statusCode: 500,
        cause: error as Error,
      });
    }
  },

  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.truckDriverAssignment.delete({ where: { id } });
    } catch (error) {
      throw new AppError({
        errorCode: ErrorCode.TRK_ASSIGNMENT_DELETE_FAILED.code,
        errorFilter: ErrorCode.TRK_ASSIGNMENT_DELETE_FAILED.filter,
        errorDescription: ErrorCode.TRK_ASSIGNMENT_DELETE_FAILED.description,
        statusCode: 500,
        cause: error as Error,
      });
    }
  },
};
