import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

const INCLUDE = {
  supplier: { select: { name: true } },
  customer: { select: { name: true } },
  pickupLocation: { select: { name: true } },
  deliveryLocation: { select: { name: true } },
  cargoType: { select: { name: true } },
  truck: { select: { truckNumber: true } },
  driver: { select: { name: true } },
} as const;

function mapOut(row: any) {
  return {
    id: row.id,
    transactionNumber: row.transactionNumber,
    supplierId: row.supplierId,
    customerId: row.customerId,
    pickupLocationId: row.pickupLocationId,
    deliveryLocationId: row.deliveryLocationId,
    cargoTypeId: row.cargoTypeId,
    quantity: row.quantity,
    tripDate: row.tripDate,
    truckId: row.truckId,
    driverId: row.driverId,
    invoiceId: row.invoiceId,
    supplierName: row.supplier?.name,
    customerName: row.customer?.name,
    pickupLocationName: row.pickupLocation?.name,
    deliveryLocationName: row.deliveryLocation?.name,
    cargoTypeName: row.cargoType?.name,
    truckNumber: row.truck?.truckNumber,
    driverName: row.driver?.name,
  };
}

/** Duck-types Prisma's unique-constraint error (P2002) without importing the generated client namespace. */
function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

function fail(code: { code: string; filter: any; description: string }, statusCode: number, cause?: unknown): never {
  throw new AppError({
    errorCode: code.code,
    errorFilter: code.filter,
    errorDescription: code.description,
    statusCode,
    cause: cause as Error,
  });
}

interface TripDto {
  transactionNumber: string;
  supplierId?: number;
  customerId?: number;
  pickupLocationId: number;
  deliveryLocationId: number;
  cargoTypeId: number;
  quantity: string;
  tripDate: string;
  truckId: number;
  driverId?: number;
}

/**
 * Direct port of the legacy TripsService: the central transaction record
 * linking a truck/driver run between two locations for a customer or
 * supplier and a cargo type. `transactionNumber` is entered by the user
 * (matches the legacy app — it was never auto-generated server-side) and
 * is enforced unique at the database level; a clash maps to
 * TRP_DUPLICATE_TRANSACTION instead of a generic failure.
 */
export const tripsService = {
  async findAll() {
    const rows = await prisma.trip.findMany({ include: INCLUDE, orderBy: { id: 'desc' } });
    return rows.map(mapOut);
  },

  async findOne(id: number) {
    const row = await prisma.trip.findUnique({ where: { id }, include: INCLUDE });
    if (!row) fail(ErrorCode.TRP_NOT_FOUND, 404);
    return mapOut(row);
  },

  async create(dto: Partial<TripDto>) {
    if (!dto.transactionNumber || !dto.pickupLocationId || !dto.deliveryLocationId || !dto.cargoTypeId || !dto.truckId || !dto.quantity || !dto.tripDate) {
      fail(ErrorCode.TRP_INVALID_RELATIONS, 400);
    }
    try {
      const row = await prisma.trip.create({
        data: {
          transactionNumber: dto.transactionNumber!,
          supplierId: dto.supplierId ?? null,
          customerId: dto.customerId ?? null,
          pickupLocationId: dto.pickupLocationId!,
          deliveryLocationId: dto.deliveryLocationId!,
          cargoTypeId: dto.cargoTypeId!,
          quantity: dto.quantity!,
          tripDate: new Date(dto.tripDate!),
          truckId: dto.truckId!,
          driverId: dto.driverId ?? null,
        },
        include: INCLUDE,
      });
      return mapOut(row);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        fail(ErrorCode.TRP_DUPLICATE_TRANSACTION, 409, error);
      }
      fail(ErrorCode.TRP_CREATE_FAILED, 500, error);
    }
  },

  async update(id: number, dto: Partial<TripDto>) {
    await this.findOne(id);
    try {
      const row = await prisma.trip.update({
        where: { id },
        data: {
          transactionNumber: dto.transactionNumber,
          supplierId: dto.supplierId,
          customerId: dto.customerId,
          pickupLocationId: dto.pickupLocationId,
          deliveryLocationId: dto.deliveryLocationId,
          cargoTypeId: dto.cargoTypeId,
          quantity: dto.quantity,
          tripDate: dto.tripDate ? new Date(dto.tripDate) : undefined,
          truckId: dto.truckId,
          driverId: dto.driverId,
        },
        include: INCLUDE,
      });
      return mapOut(row);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        fail(ErrorCode.TRP_DUPLICATE_TRANSACTION, 409, error);
      }
      fail(ErrorCode.TRP_UPDATE_FAILED, 500, error);
    }
  },

  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.trip.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.TRP_DELETE_FAILED, 500, error);
    }
  },
};
