import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../common/errors/app-error.js';
import { ErrorCode } from '../../common/errors/error-codes.js';

const INCLUDE = {
  pickupLocation: { select: { name: true, nameAr: true } },
  deliveryLocation: { select: { name: true, nameAr: true } },
  customer: { select: { name: true, nameAr: true } },
  cargoType: { select: { name: true, nameAr: true } },
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
    createdAt: row.createdAt.toISOString(),
    pickupLocationName: row.pickupLocation?.name,
    deliveryLocationName: row.deliveryLocation?.name,
    customerName: row.customer?.name,
    cargoTypeName: row.cargoType?.name,
    pickupLocationNameAr: row.pickupLocation?.nameAr,
    deliveryLocationNameAr: row.deliveryLocation?.nameAr,
    customerNameAr: row.customer?.nameAr,
    cargoTypeNameAr: row.cargoType?.nameAr,
  };
}

function fail(code: { code: string; filter: any; description: string }, statusCode: number, cause?: unknown): never {
  throw new AppError({ errorCode: code.code, errorFilter: code.filter, errorDescription: code.description, statusCode, cause: cause as Error });
}

interface CreateLoadingOrderDto {
  pickupLocationId: number;
  deliveryLocationId: number;
  customerId: number;
  cargoTypeId: number;
  quantity?: number;
}

/**
 * Direct port of the legacy LoadingOrdersService: "generate" creates
 * `quantity` individually-serialled orders (LO-0001, LO-0002, ...) in one
 * batch (batch_id = the first created row's id), the list is grouped by
 * batch, and the only delete is a whole batch at once.
 */
export const loadingOrdersService = {
  /** One row per batch (serial range + quantity) — what the list screen shows. */
  async findAllGrouped() {
    const rows = await prisma.loadingOrder.findMany({ include: INCLUDE, orderBy: { id: 'asc' } });

    interface BatchAcc {
      batchId: number;
      firstSerialNumber: string;
      lastSerialNumber: string;
      quantity: number;
      pickupLocationName: string;
      deliveryLocationName: string;
      customerName: string;
      cargoTypeName: string;
      pickupLocationNameAr: string;
      deliveryLocationNameAr: string;
      customerNameAr: string;
      cargoTypeNameAr: string;
      createdAt: string;
    }

    const batches = new Map<number, BatchAcc>();
    for (const row of rows) {
      const mapped = mapOut(row);
      const existing = batches.get(mapped.batchId);
      if (!existing) {
        batches.set(mapped.batchId, {
          batchId: mapped.batchId,
          firstSerialNumber: mapped.serialNumber,
          lastSerialNumber: mapped.serialNumber,
          quantity: 1,
          pickupLocationName: mapped.pickupLocationName ?? '',
          deliveryLocationName: mapped.deliveryLocationName ?? '',
          customerName: mapped.customerName ?? '',
          cargoTypeName: mapped.cargoTypeName ?? '',
          pickupLocationNameAr: mapped.pickupLocationNameAr ?? '',
          deliveryLocationNameAr: mapped.deliveryLocationNameAr ?? '',
          customerNameAr: mapped.customerNameAr ?? '',
          cargoTypeNameAr: mapped.cargoTypeNameAr ?? '',
          createdAt: mapped.createdAt,
        });
      } else {
        existing.quantity += 1;
        existing.lastSerialNumber = mapped.serialNumber;
      }
    }

    return Array.from(batches.values()).sort((a, b) => b.batchId - a.batchId);
  },

  /** Every individual order in a batch (used to reprint the slip set). */
  async findByBatch(batchId: number) {
    const rows = await prisma.loadingOrder.findMany({ where: { batchId }, include: INCLUDE, orderBy: { id: 'asc' } });
    if (rows.length === 0) fail(ErrorCode.LDO_BATCH_NOT_FOUND, 404);
    return rows.map(mapOut);
  },

  /** Creates `quantity` orders sharing one batch and returns every row created (used to print the PDF). */
  async create(dto: CreateLoadingOrderDto) {
    const quantity = Math.min(Math.max(dto.quantity ?? 1, 1), 200);

    try {
      return await prisma.$transaction(async (tx: any) => {
        const last = await tx.loadingOrder.findFirst({ orderBy: { id: 'desc' } });
        let nextNum = last ? last.id + 1 : 1;

        const created = [];
        for (let i = 0; i < quantity; i++) {
          const row = await tx.loadingOrder.create({
            data: {
              serialNumber: `LO-${String(nextNum).padStart(4, '0')}`,
              batchId: 0,
              pickupLocationId: dto.pickupLocationId,
              deliveryLocationId: dto.deliveryLocationId,
              customerId: dto.customerId,
              cargoTypeId: dto.cargoTypeId,
            },
            include: INCLUDE,
          });
          created.push(row);
          nextNum++;
        }

        const batchId = created[0].id;
        await tx.loadingOrder.updateMany({
          where: { id: { in: created.map((o) => o.id) } },
          data: { batchId },
        });

        return created.map((row) => mapOut({ ...row, batchId }));
      });
    } catch (error) {
      fail(ErrorCode.LDO_CREATE_FAILED, 500, error);
    }
  },

  async removeBatch(batchId: number) {
    const existing = await prisma.loadingOrder.findMany({ where: { batchId } });
    if (existing.length === 0) fail(ErrorCode.LDO_BATCH_NOT_FOUND, 404);

    try {
      await prisma.loadingOrder.deleteMany({ where: { batchId } });
    } catch (error) {
      fail(ErrorCode.LDO_DELETE_FAILED, 500, error);
    }
  },
};
