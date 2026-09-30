import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

const INCLUDE = {
  customer: { select: { name: true } },
  pickupLocation: { select: { name: true } },
  deliveryLocation: { select: { name: true } },
  cargoType: { select: { name: true } },
} as const;

function mapOut(row: any) {
  return {
    id: row.id,
    customerId: row.customerId,
    pickupLocationId: row.pickupLocationId,
    deliveryLocationId: row.deliveryLocationId,
    cargoTypeId: row.cargoTypeId,
    rate: row.rate,
    currency: row.currency,
    customerName: row.customer?.name,
    pickupLocationName: row.pickupLocation?.name,
    deliveryLocationName: row.deliveryLocation?.name,
    cargoTypeName: row.cargoType?.name,
  };
}

function fail(code: { code: string; filter: any; description: string }, statusCode: number, cause?: unknown): never {
  throw new AppError({ errorCode: code.code, errorFilter: code.filter, errorDescription: code.description, statusCode, cause: cause as Error });
}

interface RateContractDto {
  customerId: number;
  pickupLocationId: number;
  deliveryLocationId: number;
  cargoTypeId: number;
  rate: string;
  currency?: string;
}

/**
 * Direct port of the legacy RateContractsService: one negotiated rate per
 * (customer, pickup, delivery, cargo type) combination — enforced by the
 * Prisma schema's unique index, surfaced here as RLC_DUPLICATE.
 */
export const rateContractsService = {
  async findAll() {
    const rows = await prisma.rateContract.findMany({ include: INCLUDE, orderBy: { id: 'desc' } });
    return rows.map(mapOut);
  },

  async findOne(id: number) {
    const row = await prisma.rateContract.findUnique({ where: { id }, include: INCLUDE });
    if (!row) fail(ErrorCode.RLC_NOT_FOUND, 404);
    return mapOut(row);
  },

  async create(dto: Partial<RateContractDto>) {
    try {
      const row = await prisma.rateContract.create({
        data: {
          customerId: dto.customerId!,
          pickupLocationId: dto.pickupLocationId!,
          deliveryLocationId: dto.deliveryLocationId!,
          cargoTypeId: dto.cargoTypeId!,
          rate: dto.rate!,
          currency: dto.currency ?? 'SAR',
        },
        include: INCLUDE,
      });
      return mapOut(row);
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') fail(ErrorCode.RLC_DUPLICATE, 400, error);
      fail(ErrorCode.RLC_CREATE_FAILED, 500, error);
    }
  },

  async update(id: number, dto: Partial<RateContractDto>) {
    await this.findOne(id);
    try {
      const row = await prisma.rateContract.update({
        where: { id },
        data: {
          customerId: dto.customerId,
          pickupLocationId: dto.pickupLocationId,
          deliveryLocationId: dto.deliveryLocationId,
          cargoTypeId: dto.cargoTypeId,
          rate: dto.rate,
          currency: dto.currency,
        },
        include: INCLUDE,
      });
      return mapOut(row);
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') fail(ErrorCode.RLC_DUPLICATE, 400, error);
      fail(ErrorCode.RLC_UPDATE_FAILED, 500, error);
    }
  },

  async remove(id: number) {
    await this.findOne(id);
    try {
      await prisma.rateContract.delete({ where: { id } });
    } catch (error) {
      fail(ErrorCode.RLC_DELETE_FAILED, 500, error);
    }
  },
};
