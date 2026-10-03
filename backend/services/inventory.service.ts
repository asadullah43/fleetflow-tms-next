/**
 * Inventory: warehouses, stocked items, how many of each item every
 * warehouse holds, and the ledger of every movement.
 *
 * Stock lives in InventoryStock, one row per (item, warehouse), so the
 * same item can sit in several warehouses with separate quantities.
 * InventoryItem.totalQuantity is the sum over its warehouses, changed in
 * the same transaction as the warehouse row, so "low stock" (an item at
 * or below its minimum, counted across all warehouses — the minimum is
 * set per item, not per warehouse) is a single indexed comparison.
 *
 * Every change of stock goes through `addToStock` / `takeFromStock` and
 * is recorded in InventoryTransaction (IN or OUT), which is never edited
 * or deleted: a mistake is corrected by the opposite movement.
 */
import { cachedRead } from '../_core_app_connectivities/cache.js';
import { prisma } from '../_core_app_connectivities/prisma.js';
import { currentCompanyId } from '../_core_app_connectivities/tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { blankToNull, blankToUndefined, createCrudRepository } from '../data_repositories/crud.repository.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { config } from '../global_config/index.js';
import type { ListQuery } from '../models/api-response.js';
import { buildLocalizedWriteData } from '../utils/language.js';
import { filter, ListConfig, paginate } from '../utils/pagination.js';

/** A Prisma client inside `prisma.$transaction(async (tx) => …)`. */
type Tx = any;

const NAME = { select: { name: true, nameAr: true } } as const;
const ITEM_NAME = { select: { name: true, nameAr: true, itemNumber: true } } as const;

// ── Stock changes (the only code that changes a quantity) ───────────────

/**
 * Adds `quantity` of an item to one warehouse, creating that warehouse's
 * stock row on first receipt. Runs inside the caller's transaction.
 */
export async function addToStock(tx: Tx, itemId: number, warehouseId: number, quantity: number): Promise<void> {
  // INSERT … ON CONFLICT DO NOTHING, then an atomic increment: two first receipts at once cannot collide.
  await tx.inventoryStock.createMany({ data: [{ itemId, warehouseId, quantity: 0 }], skipDuplicates: true });
  await tx.inventoryStock.updateMany({ where: { itemId, warehouseId }, data: { quantity: { increment: quantity } } });
  await tx.inventoryItem.update({ where: { id: itemId }, data: { totalQuantity: { increment: quantity } } });
}

/**
 * Takes `quantity` of an item out of one warehouse, refusing to go below
 * zero there — whatever other warehouses hold. The check and the
 * decrement are one conditional UPDATE, so two simultaneous requests can
 * never both take the last units. Runs inside the caller's transaction.
 */
export async function takeFromStock(tx: Tx, itemId: number, warehouseId: number, quantity: number): Promise<void> {
  const changed = await tx.inventoryStock.updateMany({ where: { itemId, warehouseId, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
  if (changed.count === 0) {
    const item = await tx.inventoryItem.count({ where: { id: itemId } });
    if (!item) throw AppError.from(ErrorCode.STK_ITEM_NOT_FOUND, 404);
    const warehouse = await tx.warehouse.count({ where: { id: warehouseId } });
    if (!warehouse) throw AppError.from(ErrorCode.STK_WH_NOT_FOUND, 404);
    throw AppError.from(ErrorCode.STK_INSUFFICIENT, 400);
  }
  await tx.inventoryItem.update({ where: { id: itemId }, data: { totalQuantity: { decrement: quantity } } });
}

/** The item's current unit cost: what a movement or a work-order line is valued at. */
export async function currentUnitCost(tx: Tx, itemId: number) {
  const item = await tx.inventoryItem.findUnique({ where: { id: itemId }, select: { unitCost: true } });
  if (!item) throw AppError.from(ErrorCode.STK_ITEM_NOT_FOUND, 404);
  return item.unitCost;
}

// ── Warehouses ──────────────────────────────────────────────────────────

export const warehousesService = createCrudRepository({
  model: 'warehouse',
  errors: {
    notFound: ErrorCode.STK_WH_NOT_FOUND,
    inUse: ErrorCode.STK_WH_IN_USE,
    createFailed: ErrorCode.STK_WH_CREATE_FAILED,
    fetchFailed: ErrorCode.STK_WH_FETCH_FAILED,
    updateFailed: ErrorCode.STK_WH_UPDATE_FAILED,
    deleteFailed: ErrorCode.STK_WH_DELETE_FAILED,
    duplicate: ErrorCode.STK_WH_DUPLICATE,
  },
  list: {
    searchFields: ['name', 'nameAr', 'location'],
    sortFields: { id: 'id', name: 'name', location: 'location', status: 'status' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { status: filter.equals('status') },
  },
  toCreate: (input) => ({ ...buildLocalizedWriteData(input, true), status: input.status || 'ACTIVE' }),
  toUpdate: (input) => blankToUndefined(buildLocalizedWriteData(input, false), ['status']),
});

// ── Items ───────────────────────────────────────────────────────────────

/** Item number is unique per company but optional: '' means "none". */
const itemCreateData = (input: Record<string, unknown>) => ({ ...blankToUndefined(buildLocalizedWriteData(input, true), ['itemNumber', 'unitCost']), status: input.status || 'ACTIVE' });

const mapItem = (row: any) => ({ ...row, supplierName: row.supplier?.name, supplierNameAr: row.supplier?.nameAr });

export const inventoryItemsService = createCrudRepository({
  model: 'inventoryItem',
  errors: {
    notFound: ErrorCode.STK_ITEM_NOT_FOUND,
    inUse: ErrorCode.STK_ITEM_IN_USE,
    createFailed: ErrorCode.STK_ITEM_CREATE_FAILED,
    fetchFailed: ErrorCode.STK_ITEM_FETCH_FAILED,
    updateFailed: ErrorCode.STK_ITEM_UPDATE_FAILED,
    deleteFailed: ErrorCode.STK_ITEM_DELETE_FAILED,
    duplicate: ErrorCode.STK_ITEM_DUPLICATE,
  },
  include: { supplier: NAME },
  list: {
    searchFields: ['name', 'nameAr', 'itemNumber', 'category', 'supplier.name'],
    sortFields: { id: 'id', name: 'name', itemNumber: 'itemNumber', category: 'category', totalQuantity: 'totalQuantity', minimumStock: 'minimumStock', unitCost: 'unitCost', status: 'status' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: {
      status: filter.equals('status'),
      category: filter.equals('category'),
      supplierId: filter.id('supplierId'),
      /** Items with stock in this warehouse (what an OUT, or a work order, can draw from there). */
      inWarehouse: (value) => ({ stock: { some: { ...filter.id('warehouseId')(value), quantity: { gt: 0 } } } }),
      /** "LOW_STOCK": at or below minimum stock across all warehouses. */
      lowStock: (value) => (value === 'LOW_STOCK' ? { totalQuantity: { lte: prisma.inventoryItem.fields.minimumStock } } : {}),
    },
  },
  map: mapItem,
  toCreate: itemCreateData,
  toUpdate: (input) => blankToUndefined(blankToNull(buildLocalizedWriteData(input, false), ['itemNumber']), ['unitCost', 'status']),
});

// ── Stock levels (read only: quantities change through movements) ──────

const STOCK_INCLUDE = { item: { select: { name: true, nameAr: true, itemNumber: true, minimumStock: true, totalQuantity: true, unitCost: true, status: true } }, warehouse: NAME } as const;

const STOCK_LIST: ListConfig = {
  searchFields: ['item.name', 'item.nameAr', 'item.itemNumber', 'warehouse.name', 'warehouse.nameAr'],
  sortFields: { id: 'id', quantity: 'quantity', itemName: 'item.name', warehouseName: 'warehouse.name' },
  defaultSort: { field: 'id', order: 'desc' },
  filters: {
    warehouseId: filter.id('warehouseId'),
    itemId: filter.id('itemId'),
    /** "IN_STOCK": only rows with something on the shelf. */
    inStock: (value) => (value === 'IN_STOCK' ? { quantity: { gt: 0 } } : {}),
  },
};

const mapStock = (row: any) => ({
  id: row.id,
  itemId: row.itemId,
  warehouseId: row.warehouseId,
  quantity: row.quantity,
  itemName: row.item?.name,
  itemNameAr: row.item?.nameAr,
  itemNumber: row.item?.itemNumber,
  itemStatus: row.item?.status,
  minimumStock: row.item?.minimumStock,
  totalQuantity: row.item?.totalQuantity,
  unitCost: row.item?.unitCost,
  warehouseName: row.warehouse?.name,
  warehouseNameAr: row.warehouse?.nameAr,
  updatedAt: row.updatedAt,
});

export const inventoryStockService = {
  /** One row per (item, warehouse), from the company's read cache when still current. */
  async list(query: ListQuery) {
    try {
      return await cachedRead('InventoryStock.list', { query }, config.cache.listTtlSeconds, () =>
        paginate(prisma.inventoryStock, query, STOCK_LIST, { extra: { include: STOCK_INCLUDE }, map: mapStock }),
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.STK_STOCK_FETCH_FAILED, 500, error);
    }
  },
};

// ── Movements (IN / OUT) ────────────────────────────────────────────────

const MOVE_INCLUDE = { item: ITEM_NAME, warehouse: NAME, workOrder: { select: { orderNumber: true } } } as const;

const mapMove = (row: any) => ({
  id: row.id,
  itemId: row.itemId,
  warehouseId: row.warehouseId,
  type: row.type,
  quantity: row.quantity,
  unitCost: row.unitCost,
  remarks: row.remarks ?? undefined,
  workOrderId: row.workOrderId ?? undefined,
  movementDate: row.movementDate,
  createdAt: row.createdAt,
  itemName: row.item?.name,
  itemNameAr: row.item?.nameAr,
  itemNumber: row.item?.itemNumber,
  warehouseName: row.warehouse?.name,
  warehouseNameAr: row.warehouse?.nameAr,
  workOrderNumber: row.workOrder?.orderNumber,
});

const MOVES_LIST: ListConfig = {
  searchFields: ['item.name', 'item.nameAr', 'item.itemNumber', 'warehouse.name', 'remarks'],
  sortFields: { id: 'id', movementDate: 'movementDate', createdAt: 'createdAt', quantity: 'quantity', type: 'type' },
  // When the stock moved (the date the user gave), newest first; entry order breaks ties.
  defaultSort: { field: 'movementDate', order: 'desc' },
  filters: {
    type: filter.equals('type'),
    itemId: filter.id('itemId'),
    warehouseId: filter.id('warehouseId'),
    workOrderId: filter.id('workOrderId'),
    fromDate: filter.dateFrom('movementDate'),
    toDate: filter.dateTo('movementDate'),
  },
};

interface Movement {
  warehouseId: number;
  quantity: number;
  remarks?: string;
  /** "YYYY-MM-DD"; absent = today (the column's default). */
  movementDate?: string;
}

/** The movement's own date, as given — or undefined, so the database records today. */
const movedOn = (input: Movement) => (input.movementDate ? new Date(input.movementDate) : undefined);

/** Maps a failed movement to the caller's error: our own errors as they are, a clashing new item number, else a generic failure. */
function moveError(error: unknown): never {
  if (error instanceof AppError) throw error;
  if ((error as { code?: string } | null)?.code === 'P2002') throw AppError.from(ErrorCode.STK_ITEM_DUPLICATE, 409, error);
  throw AppError.from(ErrorCode.STK_MOVE_FAILED, 500, error);
}

export const inventoryTransactionsService = {
  /** The ledger, newest first, from the company's read cache when still current. */
  async list(query: ListQuery) {
    try {
      return await cachedRead('InventoryTransaction.list', { query }, config.cache.listTtlSeconds, () =>
        paginate(prisma.inventoryTransaction, query, MOVES_LIST, { extra: { include: MOVE_INCLUDE }, map: mapMove }),
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.STK_MOVE_FETCH_FAILED, 500, error);
    }
  },

  /** IN: adds stock to a warehouse — for an existing item, or a new one created in the same transaction. */
  async stockIn(input: Movement & { itemId?: number; newItem?: Record<string, unknown> }) {
    try {
      const row = await prisma.$transaction(async (tx) => {
        const companyId = currentCompanyId();
        const remarks = input.remarks || undefined;
        if (input.itemId === undefined) {
          // A new item arrives with its stock row and ledger entry in one nested write. (Separate writes
          // would fail the tenant check on foreign keys, which reads committed rows — and this item is not
          // committed yet.) The nested write's one other reference, the warehouse, is checked here instead.
          if (!(await tx.warehouse.count({ where: { id: input.warehouseId } }))) throw AppError.from(ErrorCode.STK_WH_NOT_FOUND, 404);
          const data: Record<string, unknown> = itemCreateData(input.newItem ?? {});
          const item = await tx.inventoryItem.create({
            data: {
              ...data,
              companyId,
              totalQuantity: input.quantity,
              stock: { create: { companyId, warehouseId: input.warehouseId, quantity: input.quantity } },
              transactions: {
                create: { companyId, warehouseId: input.warehouseId, type: 'IN', quantity: input.quantity, unitCost: data.unitCost as string | undefined, remarks, movementDate: movedOn(input) },
              },
            } as any,
            select: { id: true },
          });
          return tx.inventoryTransaction.findFirstOrThrow({ where: { itemId: item.id }, include: MOVE_INCLUDE });
        }
        await addToStock(tx, input.itemId, input.warehouseId, input.quantity);
        return tx.inventoryTransaction.create({
          data: {
            companyId,
            itemId: input.itemId,
            warehouseId: input.warehouseId,
            type: 'IN',
            quantity: input.quantity,
            unitCost: await currentUnitCost(tx, input.itemId),
            remarks,
            movementDate: movedOn(input),
          },
          include: MOVE_INCLUDE,
        });
      });
      return mapMove(row);
    } catch (error) {
      moveError(error);
    }
  },

  /** OUT: removes stock from one warehouse; refused if that warehouse holds fewer than `quantity` (other warehouses don't count). */
  async stockOut(input: Movement & { itemId: number }) {
    try {
      const row = await prisma.$transaction(async (tx) => {
        await takeFromStock(tx, input.itemId, input.warehouseId, input.quantity);
        return tx.inventoryTransaction.create({
          data: {
            companyId: currentCompanyId(),
            itemId: input.itemId,
            warehouseId: input.warehouseId,
            type: 'OUT',
            quantity: input.quantity,
            unitCost: await currentUnitCost(tx, input.itemId),
            remarks: input.remarks || undefined,
            movementDate: movedOn(input),
          },
          include: MOVE_INCLUDE,
        });
      });
      return mapMove(row);
    } catch (error) {
      moveError(error);
    }
  },
};
