import { prisma } from '../_core_app_connectivities/prisma.js';
import { AppError } from '../classes/app-error.js';
import { createCrudRepository } from '../data_repositories/crud.repository.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { filter } from '../utils/pagination.js';

interface AssignmentInput {
  truckId?: number;
  driverId?: number;
  startDate?: string;
  endDate?: string;
}

interface Assignment {
  id: number;
  truckId: number;
  driverId: number;
  startDate: Date;
  endDate: Date | null;
}

/**
 * A truck can't have two assignments covering the same day. endDate ===
 * null means open-ended (ongoing), so it overlaps anything that starts
 * before it ends or is itself still open.
 */
async function assertNoOverlap(truckId: number, startDate: Date, endDate: Date | null, excludeId?: number): Promise<void> {
  const overlap = await prisma.truckDriverAssignment.findFirst({
    where: {
      truckId,
      ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
      ...(endDate !== null ? { startDate: { lte: endDate } } : {}),
      OR: [{ endDate: { gte: startDate } }, { endDate: null }],
    },
  });
  if (overlap) throw AppError.from(ErrorCode.TRK_ASSIGNMENT_OVERLAP, 400);
}

function assertDateOrder(startDate: Date, endDate: Date | null): void {
  if (endDate && endDate < startDate) throw AppError.from(ErrorCode.TRK_ASSIGNMENT_INVALID_DATES, 400);
}

/** Assignments covering `day`. */
function activeOn(day: Date) {
  return { startDate: { lte: day }, OR: [{ endDate: null }, { endDate: { gte: day } }] };
}

const repository = createCrudRepository<Assignment & { truckNumber?: string; driverName?: string; driverNameAr?: string }>({
  model: 'truckDriverAssignment',
  errors: {
    notFound: ErrorCode.TRK_ASSIGNMENT_NOT_FOUND,
    inUse: ErrorCode.SYS_RECORD_IN_USE,
    createFailed: ErrorCode.TRK_ASSIGNMENT_CREATE_FAILED,
    fetchFailed: ErrorCode.TRK_ASSIGNMENT_FETCH_FAILED,
    updateFailed: ErrorCode.TRK_ASSIGNMENT_UPDATE_FAILED,
    deleteFailed: ErrorCode.TRK_ASSIGNMENT_DELETE_FAILED,
  },
  include: { truck: { select: { truckNumber: true } }, driver: { select: { name: true, nameAr: true } } },
  list: {
    searchFields: ['truck.truckNumber', 'driver.name', 'driver.nameAr'],
    sortFields: { id: 'id', startDate: 'startDate', endDate: 'endDate', truckNumber: 'truck.truckNumber', driverName: 'driver.name' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: {
      truckId: filter.id('truckId'),
      driverId: filter.id('driverId'),
      /** Only assignments in effect on this day (YYYY-MM-DD). */
      activeOn: (value) => activeOn(new Date(`${value.slice(0, 10)}T00:00:00.000Z`)),
    },
  },
  map: (row) => ({
    id: row.id,
    truckId: row.truckId,
    driverId: row.driverId,
    startDate: row.startDate,
    endDate: row.endDate,
    truckNumber: row.truck?.truckNumber,
    driverName: row.driver?.name,
    driverNameAr: row.driver?.nameAr,
  }),
  toCreate: async (input: Required<Pick<AssignmentInput, 'truckId' | 'driverId' | 'startDate'>> & AssignmentInput) => {
    const startDate = new Date(input.startDate);
    const endDate = input.endDate ? new Date(input.endDate) : null;
    assertDateOrder(startDate, endDate);
    await assertNoOverlap(input.truckId, startDate, endDate);
    return { truckId: input.truckId, driverId: input.driverId, startDate, endDate };
  },
  toUpdate: async (input: AssignmentInput & { id?: number }, existing) => {
    const truckId = input.truckId ?? existing.truckId;
    const startDate = input.startDate ? new Date(input.startDate) : new Date(existing.startDate);
    // An explicit '' clears the end date (assignment becomes ongoing); undefined leaves it as it was.
    const endDate = input.endDate !== undefined ? (input.endDate ? new Date(input.endDate) : null) : existing.endDate ? new Date(existing.endDate) : null;
    assertDateOrder(startDate, endDate);
    await assertNoOverlap(truckId, startDate, endDate, existing.id);
    return {
      truckId: input.truckId,
      driverId: input.driverId,
      startDate: input.startDate ? startDate : undefined,
      endDate: input.endDate !== undefined ? endDate : undefined,
    };
  },
});

/** Truck <-> driver assignments over date ranges (which driver is running which truck). */
export const assignmentsService = {
  ...repository,

  /** The driver assigned to `truckId` on `day`, if any — the single source of that rule (Trips uses it). */
  async driverForTruckOn(truckId: number, day: Date): Promise<number | null> {
    const assignment = await prisma.truckDriverAssignment.findFirst({
      where: { truckId, ...activeOn(day) },
      orderBy: { startDate: 'desc' },
      select: { driverId: true },
    });
    return assignment?.driverId ?? null;
  },
};
