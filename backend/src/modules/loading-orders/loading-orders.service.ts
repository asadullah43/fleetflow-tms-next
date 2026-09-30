import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

const INCLUDE = {
  pickupLocation: { select: { name: true } },
  deliveryLocation: { select: { name: true } },
  customer: { select: { name: true } },
  cargoType: { select: { name: true } },
} as const;

function mapOut(row: any) {
  return {
    id: row.id,
    serialNumber: row.serialNumber,
    batchId: row.batchId,
    pickupLocationId: row.pickupLocationId,
    deliveryLocationId: row.deliveryLocationId,
    customerId: row.customerId,
    cargoTypeId: row.cargoTypeId,
    pickupLocationName: row.pickupLocation?.name,
    deliveryLocationName: row.deliveryLocation?.name,
    customerName: row.customer?.name,
    cargoTypeName: row.cargoType?.name,
  };
}

function fail(code: { code: string; filter: any; description: string }, statusCode: number, cause?: unknown): never {
  throw new AppError({ errorCode: code.code, errorFilter: code.filter, errorDescription: code.description, statusCode, cause: cause as Error });
}

async function generateSerialNumber(): Promise<string> {
  const count = await prisma.loadingOrder.count();
  return `LO-${String(count + 1).padStart(6, '0')}`;
}

interface LoadingOrderDto {
  batchId: number;
  pickupLocationId: number;
  deliveryLocationId: number;
  customerId: number;
  cargoTypeId: number;
}

/** Direct port of the legacy LoadingOrdersService — one printable pickup slip per batch line. */
export const loadingOrdersService = {
  async findAll() {
    const rows = await prisma.loadingOrder.findMany({ include: INCLUDE, orderBy: { id: 'desc' } });
    return rows.map(mapOut);
  },

  async findOne(id: number) {
    const row = await prisma.loadingOrder.findUnique({ where: { id }, include: INCLUDE });
    if (!row) fail(ErrorCode.LDO_BATCH_NOT_FOUND, 404);
    return mapOut(row);
  },

  async create(dto: Partial<LoadingOrderDto>) {
    try {
      const serialNumber = await generateSerialNumber();
      const row = await prisma.loadingOrder.create({
        data: {
          serialNumber,
          batchId: dto.batchId!,
          pickupLocationId: dto.pickupLocationId!,
          deliveryLocationId: dto.deliveryLocationId!,
          customerId: dto.customerId!,
          cargoTypeId: dto.cargoTypeId!,
        },
        include: INCLUDE,
      });
      return mapOut(row);
    } catch (error) {
      fail(ErrorCode.LDO_CREATE_FAILED, 500, error);
    }
  },

  async update(id: number, dto: Partial<LoadingOrderDto>) {
    await this.findOne(id);
    try {
      const row = await prisma.loadingOrder.update({
        where: { id },
        data: {
          batchId: dto.batchId,
          pickupLocationId: dto.pickupLocationId,
          deliveryLocationId: dto.deliveryLocationId,
          customerId: dto.customerId,
          cargoTypeId: dto.cargoTypeId,
        },
        include: INCLUDE,
      });
      return mapOut(row);
    } catch (error) {
      fail(ErrorCode.LDO_CREATE_FAILED, 500, error);
    }
  },

  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.loadingOrder.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.LDO_DELETE_FAILED, 500, error);
    }
  },
};
