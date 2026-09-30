import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

const INCLUDE = { truck: { select: { truckNumber: true } }, driver: { select: { name: true } } } as const;

function mapOut(row: any) {
  return {
    id: row.id,
    truckId: row.truckId,
    driverId: row.driverId,
    startDate: row.startDate,
    endDate: row.endDate,
    truckNumber: row.truck?.truckNumber,
    driverName: row.driver?.name,
  };
}

/**
 * Direct port of the legacy truck<->driver assignment service: tracks
 * which driver is running which truck over a date range, with an
 * overlap check (a truck can't have two active assignments at once).
 */
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
    try {
      const row = await prisma.truckDriverAssignment.create({
        data: {
          truckId: dto.truckId,
          driverId: dto.driverId,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        },
        include: INCLUDE,
      });
      return mapOut(row);
    } catch (error) {
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
    await this.findOne(id);
    try {
      const row = await prisma.truckDriverAssignment.update({
        where: { id },
        data: {
          truckId: dto.truckId,
          driverId: dto.driverId,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        },
        include: INCLUDE,
      });
      return mapOut(row);
    } catch (error) {
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
