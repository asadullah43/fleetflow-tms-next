import { prisma } from '../_core_app_connectivities/prisma.js';
import { currentCompanyId } from '../_core_app_connectivities/tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { ErrorCode } from '../global_config/error-codes.js';
import type { ListQuery } from '../models/api-response.js';
import { buildListArgs, filter, ListConfig, paginationMeta } from '../utils/pagination.js';
import { nextInSequence } from '../utils/sequence.js';
import { companySettingsService } from './company-settings.service.js';

const NAME = { select: { name: true, nameAr: true } } as const;
const INCLUDE = { pickupLocation: NAME, deliveryLocation: NAME, customer: NAME, cargoType: NAME } as const;

const MAX_BATCH_SIZE = 200;
const SERIAL_ATTEMPTS = 5;

const LIST: ListConfig = {
  searchFields: ['serialNumber', 'customer.name', 'customer.nameAr', 'pickupLocation.name', 'deliveryLocation.name', 'cargoType.name'],
  sortFields: { batchId: 'batchId' },
  defaultSort: { field: 'batchId', order: 'desc' },
  filters: {
    customerId: filter.id('customerId'),
    cargoTypeId: filter.id('cargoTypeId'),
    pickupLocationId: filter.id('pickupLocationId'),
    deliveryLocationId: filter.id('deliveryLocationId'),
    fromDate: filter.dateFrom('createdAt'),
    toDate: filter.dateTo('createdAt'),
  },
};

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

interface CreateLoadingOrderInput {
  pickupLocationId: number;
  deliveryLocationId: number;
  customerId: number;
  cargoTypeId: number;
  quantity?: number;
}

const serial = (n: number) => `LO-${String(n).padStart(4, '0')}`;

/**
 * "Generate Loading Order" creates `quantity` individually-serialled
 * slips (LO-0001, LO-0002, ...) sharing one batch; the list shows one row
 * per batch; the only delete is a whole batch. Serials run per company.
 */
export const loadingOrdersService = {
  /** One row per batch (serial range + quantity), paged by batch. */
  async listGrouped(query: ListQuery) {
    try {
      const { where, skip, take } = buildListArgs(query, LIST);
      const order = query.sortBy && query.sortOrder === 'asc' ? 'asc' : 'desc';
      const [page, all] = await Promise.all([
        prisma.loadingOrder.groupBy({ by: ['batchId'], where, _count: { _all: true }, _min: { id: true }, _max: { id: true }, orderBy: { batchId: order }, skip, take }),
        prisma.loadingOrder.groupBy({ by: ['batchId'], where }),
      ]);

      // First and last slip of each batch on this page, for the serial range and the display names.
      const edgeIds = page.flatMap((batch) => [batch._min.id, batch._max.id]).filter((id): id is number => id !== null);
      const edges = await prisma.loadingOrder.findMany({ where: { id: { in: edgeIds } }, include: INCLUDE });
      const byId = new Map(edges.map((row) => [row.id, mapOut(row)]));

      const items = page.map((batch) => {
        const first = byId.get(batch._min.id ?? -1);
        const last = byId.get(batch._max.id ?? -1);
        return {
          batchId: batch.batchId,
          firstSerialNumber: first?.serialNumber ?? '',
          lastSerialNumber: last?.serialNumber ?? '',
          quantity: batch._count._all,
          pickupLocationName: first?.pickupLocationName ?? '',
          deliveryLocationName: first?.deliveryLocationName ?? '',
          customerName: first?.customerName ?? '',
          cargoTypeName: first?.cargoTypeName ?? '',
          pickupLocationNameAr: first?.pickupLocationNameAr ?? undefined,
          deliveryLocationNameAr: first?.deliveryLocationNameAr ?? undefined,
          customerNameAr: first?.customerNameAr ?? undefined,
          cargoTypeNameAr: first?.cargoTypeNameAr ?? undefined,
          createdAt: first?.createdAt ?? '',
        };
      });
      return { items, pagination: paginationMeta(query, all.length) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.LDO_FETCH_FAILED, 500, error);
    }
  },

  /** Every individual slip in a batch. */
  async findByBatch(batchId: number) {
    const rows = await prisma.loadingOrder.findMany({ where: { batchId }, include: INCLUDE, orderBy: { id: 'asc' } });
    if (rows.length === 0) throw AppError.from(ErrorCode.LDO_BATCH_NOT_FOUND, 404);
    return { items: rows.map(mapOut) };
  },

  /**
   * Everything the printable document shows — the batch's slips and the
   * company's branding — read from the database at print time, so the
   * PDF never depends on what the browser happens to have cached.
   */
  async getBatchDocument(batchId: number) {
    const { items } = await this.findByBatch(batchId);
    try {
      const settings = await companySettingsService.getOrCreate();
      return {
        company: {
          companyName: settings.companyName,
          logoUrl: settings.logoUrl ?? undefined,
          vatNumber: settings.vatNumber ?? undefined,
          crNumber: settings.crNumber ?? undefined,
          address: settings.address ?? undefined,
          city: settings.city ?? undefined,
          phone: settings.phone ?? undefined,
          email: settings.email ?? undefined,
        },
        orders: items,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.LDO_DOCUMENT_FAILED, 500, error);
    }
  },

  /** Creates `quantity` slips in one transaction and returns them all. */
  async create(input: CreateLoadingOrderInput) {
    const quantity = Math.min(Math.max(input.quantity || 1, 1), MAX_BATCH_SIZE);
    const companyId = currentCompanyId();

    for (let attempt = 1; ; attempt++) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          const last = await tx.loadingOrder.findFirst({ orderBy: { id: 'desc' }, select: { serialNumber: true } });
          const start = Number(/(\d+)$/.exec(nextInSequence(last?.serialNumber, String))?.[1] ?? 1);

          const rows = [];
          for (let i = 0; i < quantity; i++) {
            rows.push(
              await tx.loadingOrder.create({
                data: {
                  companyId,
                  serialNumber: serial(start + i),
                  batchId: 0,
                  pickupLocationId: input.pickupLocationId,
                  deliveryLocationId: input.deliveryLocationId,
                  customerId: input.customerId,
                  cargoTypeId: input.cargoTypeId,
                },
                include: INCLUDE,
              }),
            );
          }
          const batchId = rows[0].id;
          await tx.loadingOrder.updateMany({ where: { id: { in: rows.map((row) => row.id) } }, data: { batchId } });
          return rows.map((row) => mapOut({ ...row, batchId }));
        });
        return { items: created };
      } catch (error) {
        if (error instanceof AppError) throw error;
        // Another request took the same serials first: the whole batch rolled back, so take fresh numbers.
        if ((error as { code?: string })?.code === 'P2002' && attempt < SERIAL_ATTEMPTS) continue;
        throw AppError.from(ErrorCode.LDO_CREATE_FAILED, 500, error);
      }
    }
  },

  async removeBatch(batchId: number) {
    const count = await prisma.loadingOrder.count({ where: { batchId } });
    if (count === 0) throw AppError.from(ErrorCode.LDO_BATCH_NOT_FOUND, 404);
    try {
      await prisma.loadingOrder.deleteMany({ where: { batchId } });
    } catch (error) {
      throw AppError.from(ErrorCode.LDO_DELETE_FAILED, 500, error);
    }
  },
};
