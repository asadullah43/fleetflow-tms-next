import { prisma } from '../_core_app_connectivities/prisma.js';
import { currentCompanyId } from '../_core_app_connectivities/tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { blankToNull, blankToUndefined, createCrudRepository, withDates } from '../data_repositories/crud.repository.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { buildLocalizedWriteData } from '../utils/language.js';
import { fromCents, toCents } from '../utils/money.js';
import { filter } from '../utils/pagination.js';
import { createWithSequence } from '../utils/sequence.js';
import { addToStock, currentUnitCost, takeFromStock } from './inventory.service.js';

/** A cost field: blank means "use the fallback"; anything else must be a valid non-negative amount. */
function costCents(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const cents = toCents(value as string);
  if (cents === null) throw AppError.from(ErrorCode.SYS_VALIDATION_ERROR, 400);
  return cents;
}

const decimalCents = (value: { toFixed(digits: number): string }) => toCents(value.toFixed(2)) ?? 0;

/** Status COMPLETED without a completion date gets today — the dashboard's "completed this month" counts by this date. */
function completionDateFor(status: string | undefined, given: string | undefined, existing?: Date | string | null): Date | undefined {
  if (given) return new Date(given);
  if (status === 'COMPLETED' && !existing) return new Date();
  return undefined;
}

const TRUCK = { truck: { select: { truckNumber: true } } } as const;
const withTruckNumber = (row: any) => ({ ...row, truckNumber: row.truck?.truckNumber });
const truckFilters = { truckId: filter.id('truckId'), status: filter.equals('status') };

// ── Work orders ─────────────────────────────────────────────────────────
const WO_INCLUDE = { ...TRUCK, driver: { select: { name: true, nameAr: true } } } as const;
const mapWorkOrder = (row: any) => ({ ...row, truckNumber: row.truck?.truckNumber, driverName: row.driver?.name, driverNameAr: row.driver?.nameAr });

const workOrdersRepository = createCrudRepository({
  model: 'workOrder',
  errors: {
    notFound: ErrorCode.WKS_NOT_FOUND,
    // The only reference that blocks a delete is an inventory line (WorkOrderPart: onDelete Restrict). Refused until each
    // line is removed — which returns its stock — rather than deleting the lines and keeping the stock consumed.
    inUse: ErrorCode.WKS_HAS_INVENTORY,
    createFailed: ErrorCode.WKS_CREATE_FAILED,
    fetchFailed: ErrorCode.WKS_FETCH_FAILED,
    updateFailed: ErrorCode.WKS_UPDATE_FAILED,
    deleteFailed: ErrorCode.WKS_DELETE_FAILED,
  },
  include: WO_INCLUDE,
  list: {
    searchFields: ['orderNumber', 'issue', 'truck.truckNumber', 'driver.name', 'driver.nameAr'],
    sortFields: { id: 'id', orderNumber: 'orderNumber', status: 'status', priority: 'priority', startDate: 'startDate', totalCost: 'totalCost' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { ...truckFilters, priority: filter.equals('priority'), driverId: filter.id('driverId') },
  },
  map: mapWorkOrder,
  // totalCost is always derived here from its three parts, never taken from the client.
  toUpdate: (input: Record<string, any>, existing: any) => {
    const laborCost = costCents(input.laborCost, decimalCents(existing.laborCost));
    const partsCost = costCents(input.partsCost, decimalCents(existing.partsCost));
    const otherCost = costCents(input.otherCost, decimalCents(existing.otherCost));
    return {
      ...blankToUndefined(input, ['status', 'priority']),
      odometer: input.odometer || undefined,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      completionDate: completionDateFor(input.status, input.completionDate, existing.completionDate),
      laborCost: fromCents(laborCost),
      partsCost: fromCents(partsCost),
      otherCost: fromCents(otherCost),
      totalCost: fromCents(laborCost + partsCost + otherCost),
    };
  },
});

interface PartInput {
  itemId: number;
  warehouseId: number;
  quantity: number;
}

/**
 * Takes one line's stock out of its warehouse (refused, per warehouse, if
 * it holds too few) and values it at the item's unit cost. Every way a
 * work order uses inventory — at creation or later — goes through here.
 */
async function consumeLine(tx: any, line: PartInput) {
  await takeFromStock(tx, line.itemId, line.warehouseId, line.quantity);
  const unitCost = await currentUnitCost(tx, line.itemId);
  return { ...line, unitCost, cents: decimalCents(unitCost) * line.quantity };
}

const usedOn = (orderNumber: string) => `Used on work order ${orderNumber}`;

export const workOrdersService = {
  ...workOrdersRepository,

  /**
   * Order numbers (WO-00007) are assigned here, one running sequence per
   * company. `parts`: inventory used, taken from stock in the same
   * transaction as the order is created — all of it, or (one line short
   * of stock) nothing at all. Their total is added to the parts cost.
   */
  async create(input: Record<string, any>) {
    const lines: PartInput[] = input.parts ?? [];
    const laborCost = costCents(input.laborCost, 0);
    const partsCost = costCents(input.partsCost, 0);
    const otherCost = costCents(input.otherCost, 0);
    const status = input.status || 'OPEN';
    try {
      const row = await createWithSequence(
        async () => (await prisma.workOrder.findFirst({ orderBy: { id: 'desc' }, select: { orderNumber: true } }))?.orderNumber,
        (n) => `WO-${String(n).padStart(5, '0')}`,
        (orderNumber) =>
          prisma.$transaction(async (tx) => {
            const consumed = [];
            for (const line of lines) consumed.push(await consumeLine(tx, line));
            const linesCents = consumed.reduce((sum, line) => sum + line.cents, 0);
            const companyId = currentCompanyId();
            // One nested write: the order with its lines and their ledger entries. (Separate writes would fail the
            // tenant check on foreign keys, which reads committed rows — this order is not committed yet. The items
            // and warehouses were verified by consumeLine: their stock rows were found and updated in this company.)
            return tx.workOrder.create({
              data: {
                companyId,
                orderNumber,
                truckId: input.truckId,
                driverId: input.driverId,
                supplierId: input.supplierId,
                issue: input.issue,
                diagnosis: input.diagnosis,
                description: input.description,
                priority: input.priority || 'MEDIUM',
                status,
                startDate: input.startDate ? new Date(input.startDate) : undefined,
                completionDate: completionDateFor(status, input.completionDate),
                odometer: input.odometer || undefined,
                laborCost: fromCents(laborCost),
                partsCost: fromCents(partsCost + linesCents),
                otherCost: fromCents(otherCost),
                totalCost: fromCents(laborCost + partsCost + linesCents + otherCost),
                notes: input.notes,
                parts: {
                  create: consumed.map((line) => ({
                    companyId,
                    itemId: line.itemId,
                    warehouseId: line.warehouseId,
                    quantity: line.quantity,
                    unitCost: line.unitCost,
                    totalCost: fromCents(line.cents),
                  })),
                },
                inventoryTransactions: {
                  create: consumed.map((line) => ({
                    companyId,
                    itemId: line.itemId,
                    warehouseId: line.warehouseId,
                    type: 'OUT',
                    quantity: line.quantity,
                    unitCost: line.unitCost,
                    remarks: usedOn(orderNumber),
                  })),
                },
              } as any,
              include: WO_INCLUDE,
            });
          }),
      );
      return mapWorkOrder(row);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.WKS_CREATE_FAILED, 500, error);
    }
  },
};

// ── Maintenance schedules ───────────────────────────────────────────────
export const maintenanceSchedulesService = createCrudRepository({
  model: 'maintenanceSchedule',
  errors: {
    notFound: ErrorCode.WKS_MNT_NOT_FOUND,
    inUse: ErrorCode.SYS_RECORD_IN_USE,
    createFailed: ErrorCode.WKS_MNT_CREATE_FAILED,
    fetchFailed: ErrorCode.WKS_MNT_FETCH_FAILED,
    updateFailed: ErrorCode.WKS_MNT_UPDATE_FAILED,
    deleteFailed: ErrorCode.WKS_MNT_DELETE_FAILED,
  },
  include: TRUCK,
  list: {
    searchFields: ['maintenanceType', 'description', 'truck.truckNumber'],
    sortFields: { id: 'id', maintenanceType: 'maintenanceType', nextService: 'nextService', lastService: 'lastService', status: 'status' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { ...truckFilters, dueFrom: filter.dateFrom('nextService'), dueTo: filter.dateTo('nextService') },
  },
  map: withTruckNumber,
  toCreate: (input) => ({ ...withDates(input, ['lastService', 'nextService']), status: input.status || 'ACTIVE' }),
  toUpdate: (input) => blankToUndefined(withDates(input, ['lastService', 'nextService']), ['status']),
});

// ── Vehicle inspections ─────────────────────────────────────────────────
export const vehicleInspectionsService = createCrudRepository({
  model: 'vehicleInspection',
  errors: {
    notFound: ErrorCode.WKS_INS_NOT_FOUND,
    inUse: ErrorCode.SYS_RECORD_IN_USE,
    createFailed: ErrorCode.WKS_INS_CREATE_FAILED,
    fetchFailed: ErrorCode.WKS_INS_FETCH_FAILED,
    updateFailed: ErrorCode.WKS_INS_UPDATE_FAILED,
    deleteFailed: ErrorCode.WKS_INS_DELETE_FAILED,
  },
  include: { ...TRUCK, inspector: { select: { name: true } } },
  list: {
    searchFields: ['truck.truckNumber', 'inspector.name', 'notes'],
    sortFields: { id: 'id', inspectDate: 'inspectDate', result: 'result' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { truckId: filter.id('truckId'), result: filter.equals('result'), fromDate: filter.dateFrom('inspectDate'), toDate: filter.dateTo('inspectDate') },
  },
  map: (row) => ({ ...row, truckNumber: row.truck?.truckNumber, inspectorName: row.inspector?.name }),
  toCreate: (input) => ({ ...withDates(input, ['inspectDate']), result: input.result || 'PASS' }),
  toUpdate: (input) => blankToUndefined(withDates(input, ['inspectDate']), ['result']),
});

// ── Workshop expenses ───────────────────────────────────────────────────
export const workshopExpensesService = createCrudRepository({
  model: 'workshopExpense',
  errors: {
    notFound: ErrorCode.WKS_EXP_NOT_FOUND,
    inUse: ErrorCode.SYS_RECORD_IN_USE,
    createFailed: ErrorCode.WKS_EXP_CREATE_FAILED,
    fetchFailed: ErrorCode.WKS_EXP_FETCH_FAILED,
    updateFailed: ErrorCode.WKS_EXP_UPDATE_FAILED,
    deleteFailed: ErrorCode.WKS_EXP_DELETE_FAILED,
  },
  include: TRUCK,
  list: {
    searchFields: ['category', 'description', 'truck.truckNumber'],
    sortFields: { id: 'id', expenseDate: 'expenseDate', amount: 'amount', category: 'category' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: {
      truckId: filter.id('truckId'),
      workOrderId: filter.id('workOrderId'),
      category: filter.equals('category'),
      fromDate: filter.dateFrom('expenseDate'),
      toDate: filter.dateTo('expenseDate'),
    },
  },
  map: withTruckNumber,
  toCreate: (input) => ({ ...input, expenseDate: input.expenseDate ? new Date(input.expenseDate) : new Date() }),
  toUpdate: (input) => withDates(input, ['expenseDate']),
});

// ── Line items: inventory used on a work order, inspection items ───────
const PART_INCLUDE = { item: { select: { name: true, nameAr: true, itemNumber: true } }, warehouse: { select: { name: true, nameAr: true } } } as const;
const mapPart = (row: any) => ({
  ...row,
  itemName: row.item?.name,
  itemNameAr: row.item?.nameAr,
  itemNumber: row.item?.itemNumber,
  warehouseName: row.warehouse?.name,
  warehouseNameAr: row.warehouse?.nameAr,
});

const workOrderPartsRepository = createCrudRepository({
  model: 'workOrderPart',
  errors: {
    notFound: ErrorCode.WKS_PART_NOT_FOUND,
    inUse: ErrorCode.SYS_RECORD_IN_USE,
    createFailed: ErrorCode.WKS_CREATE_FAILED,
    fetchFailed: ErrorCode.WKS_FETCH_FAILED,
    updateFailed: ErrorCode.WKS_UPDATE_FAILED,
    deleteFailed: ErrorCode.WKS_DELETE_FAILED,
  },
  include: PART_INCLUDE,
  list: {
    searchFields: ['item.name', 'item.nameAr', 'item.itemNumber', 'warehouse.name'],
    sortFields: { id: 'id', quantity: 'quantity', totalCost: 'totalCost' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { workOrderId: filter.id('workOrderId'), itemId: filter.id('itemId'), warehouseId: filter.id('warehouseId') },
  },
  map: mapPart,
});

/** Moves a work order's parts cost (and so its total) by `cents`, inside the caller's transaction. */
function adjustWorkOrderCost(tx: any, workOrderId: number, cents: number) {
  const amount = fromCents(Math.abs(cents));
  const change = cents >= 0 ? { increment: amount } : { decrement: amount };
  return tx.workOrder.update({ where: { id: workOrderId }, data: { partsCost: change, totalCost: change } });
}

/**
 * Inventory used on a repair. Each line names the warehouse it was taken
 * from (an item can be stocked in several, with separate quantities), is
 * valued at the item's unit cost at the time, and adds that amount to the
 * work order's parts cost and total. Lines are added or removed, not
 * edited: removing one puts the stock back where it came from and takes
 * its amount off the work order. Every line is also an OUT (or, removed,
 * an IN) in the inventory ledger, linked to the work order.
 */
export const workOrderPartsService = {
  list: workOrderPartsRepository.list,

  async create(input: { workOrderId: number; itemId: number; warehouseId: number; quantity: number }) {
    try {
      const row = await prisma.$transaction(async (tx) => {
        const workOrder = await tx.workOrder.findUnique({ where: { id: input.workOrderId }, select: { orderNumber: true } });
        if (!workOrder) throw AppError.from(ErrorCode.WKS_NOT_FOUND, 404);
        const { unitCost, cents } = await consumeLine(tx, input);
        const part = await tx.workOrderPart.create({
          data: {
            companyId: currentCompanyId(),
            workOrderId: input.workOrderId,
            itemId: input.itemId,
            warehouseId: input.warehouseId,
            quantity: input.quantity,
            unitCost,
            totalCost: fromCents(cents),
          },
          include: PART_INCLUDE,
        });
        await adjustWorkOrderCost(tx, input.workOrderId, cents);
        await tx.inventoryTransaction.create({
          data: {
            companyId: currentCompanyId(),
            itemId: input.itemId,
            warehouseId: input.warehouseId,
            type: 'OUT',
            quantity: input.quantity,
            unitCost,
            workOrderId: input.workOrderId,
            remarks: usedOn(workOrder.orderNumber),
          },
        });
        return part;
      });
      return mapPart(row);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.WKS_CREATE_FAILED, 500, error);
    }
  },

  async remove(id: number) {
    try {
      await prisma.$transaction(async (tx) => {
        const part = await tx.workOrderPart.findUnique({ where: { id }, include: { workOrder: { select: { orderNumber: true } } } });
        if (!part) throw AppError.from(ErrorCode.WKS_PART_NOT_FOUND, 404);
        await tx.workOrderPart.delete({ where: { id } });
        await addToStock(tx, part.itemId, part.warehouseId, part.quantity);
        await adjustWorkOrderCost(tx, part.workOrderId, -decimalCents(part.totalCost));
        await tx.inventoryTransaction.create({
          data: {
            companyId: currentCompanyId(),
            itemId: part.itemId,
            warehouseId: part.warehouseId,
            type: 'IN',
            quantity: part.quantity,
            unitCost: part.unitCost,
            workOrderId: part.workOrderId,
            remarks: `Returned from work order ${part.workOrder.orderNumber}`,
          },
        });
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.WKS_DELETE_FAILED, 500, error);
    }
  },
};

export const inspectionItemsService = createCrudRepository({
  model: 'inspectionItem',
  errors: {
    notFound: ErrorCode.WKS_INS_ITEM_NOT_FOUND,
    inUse: ErrorCode.SYS_RECORD_IN_USE,
    createFailed: ErrorCode.WKS_INS_CREATE_FAILED,
    fetchFailed: ErrorCode.WKS_INS_FETCH_FAILED,
    updateFailed: ErrorCode.WKS_INS_UPDATE_FAILED,
    deleteFailed: ErrorCode.WKS_INS_DELETE_FAILED,
  },
  list: {
    searchFields: ['checklistItem', 'defect'],
    sortFields: { id: 'id', status: 'status' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { inspectionId: filter.id('inspectionId'), workOrderId: filter.id('workOrderId'), status: filter.equals('status') },
  },
  toCreate: (input) => ({ ...input, status: input.status || 'PASS' }),
  toUpdate: (input) => blankToUndefined(input, ['status']),
});
