import { prisma } from '../_core_app_connectivities/prisma.js';
import { currentCompanyId } from '../_core_app_connectivities/tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { blankToNull, blankToUndefined, createCrudRepository, withDates } from '../data_repositories/crud.repository.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { buildLocalizedWriteData } from '../utils/language.js';
import { fromCents, toCents } from '../utils/money.js';
import { filter } from '../utils/pagination.js';
import { createWithSequence } from '../utils/sequence.js';

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
    inUse: ErrorCode.SYS_RECORD_IN_USE,
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

export const workOrdersService = {
  ...workOrdersRepository,

  /** Order numbers (WO-00007) are assigned here, one running sequence per company. */
  async create(input: Record<string, any>) {
    const laborCost = costCents(input.laborCost, 0);
    const partsCost = costCents(input.partsCost, 0);
    const otherCost = costCents(input.otherCost, 0);
    const status = input.status || 'OPEN';
    try {
      const row = await createWithSequence(
        async () => (await prisma.workOrder.findFirst({ orderBy: { id: 'desc' }, select: { orderNumber: true } }))?.orderNumber,
        (n) => `WO-${String(n).padStart(5, '0')}`,
        (orderNumber) =>
          prisma.workOrder.create({
            data: {
              companyId: currentCompanyId(),
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
              partsCost: fromCents(partsCost),
              otherCost: fromCents(otherCost),
              totalCost: fromCents(laborCost + partsCost + otherCost),
              notes: input.notes,
            },
            include: WO_INCLUDE,
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

// ── Spare parts ─────────────────────────────────────────────────────────
export const sparePartsService = createCrudRepository({
  model: 'sparePart',
  errors: {
    notFound: ErrorCode.WKS_SPK_NOT_FOUND,
    inUse: ErrorCode.SYS_RECORD_IN_USE,
    createFailed: ErrorCode.WKS_SPK_CREATE_FAILED,
    fetchFailed: ErrorCode.WKS_SPK_FETCH_FAILED,
    updateFailed: ErrorCode.WKS_SPK_UPDATE_FAILED,
    deleteFailed: ErrorCode.WKS_SPK_DELETE_FAILED,
    duplicate: ErrorCode.WKS_SPK_DUPLICATE,
  },
  include: { supplier: { select: { name: true, nameAr: true } } },
  list: {
    searchFields: ['name', 'nameAr', 'partNumber', 'category', 'supplier.name'],
    sortFields: { id: 'id', name: 'name', partNumber: 'partNumber', quantity: 'quantity', unitCost: 'unitCost', status: 'status' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { status: filter.equals('status'), category: filter.equals('category'), supplierId: filter.id('supplierId') },
  },
  map: (row) => ({ ...row, supplierName: row.supplier?.name, supplierNameAr: row.supplier?.nameAr }),
  // Part numbers are unique per company but optional: blank means "none".
  toCreate: (input) => blankToUndefined(buildLocalizedWriteData(input, true), ['partNumber', 'unitCost']),
  toUpdate: (input) => blankToUndefined(blankToNull(buildLocalizedWriteData(input, false), ['partNumber']), ['unitCost']),
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

// ── Line items: work order parts, inspection items, stock movements ─────
const PART_NAME = { sparePart: { select: { name: true, nameAr: true } } } as const;
const withPartName = (row: any) => ({ ...row, sparePartName: row.sparePart?.name, sparePartNameAr: row.sparePart?.nameAr });

/** Takes `quantity` out of stock, refusing to go below zero. Runs inside the caller's transaction. */
async function takeFromStock(tx: any, sparePartId: number, quantity: number): Promise<void> {
  if (quantity <= 0) return;
  const changed = await tx.sparePart.updateMany({ where: { id: sparePartId, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
  if (changed.count === 0) {
    const exists = await tx.sparePart.count({ where: { id: sparePartId } });
    throw AppError.from(exists ? ErrorCode.WKS_SPK_LOW_STOCK : ErrorCode.WKS_SPK_NOT_FOUND, exists ? 400 : 404);
  }
}

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
  include: PART_NAME,
  list: {
    searchFields: ['sparePart.name', 'sparePart.partNumber'],
    sortFields: { id: 'id', quantity: 'quantity', totalCost: 'totalCost' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { workOrderId: filter.id('workOrderId'), sparePartId: filter.id('sparePartId') },
  },
  map: withPartName,
});

function lineTotal(unitCost: string, quantity: number): string {
  const cents = toCents(unitCost);
  if (cents === null) throw AppError.from(ErrorCode.SYS_VALIDATION_ERROR, 400);
  return fromCents(cents * quantity);
}

export const workOrderPartsService = {
  list: workOrderPartsRepository.list,
  remove: workOrderPartsRepository.remove,

  /** Using a part on a work order takes it out of stock in the same transaction. */
  async create(input: { workOrderId: number; sparePartId: number; quantity: number; unitCost: string }) {
    const totalCost = lineTotal(input.unitCost, input.quantity);
    try {
      const row = await prisma.$transaction(async (tx) => {
        await takeFromStock(tx, input.sparePartId, input.quantity);
        return tx.workOrderPart.create({
          data: { companyId: currentCompanyId(), workOrderId: input.workOrderId, sparePartId: input.sparePartId, quantity: input.quantity, unitCost: input.unitCost, totalCost },
          include: PART_NAME,
        });
      });
      return withPartName(row);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.WKS_CREATE_FAILED, 500, error);
    }
  },

  async update(id: number, input: { quantity?: number; unitCost?: string }) {
    const existing = await workOrderPartsRepository.findOne(id);
    const quantity = input.quantity || existing.quantity;
    const unitCost = input.unitCost || existing.unitCost.toString();
    try {
      const row = await prisma.workOrderPart.update({
        where: { id },
        data: { quantity, unitCost, totalCost: lineTotal(unitCost, quantity) },
        include: PART_NAME,
      });
      return withPartName(row);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.from(ErrorCode.WKS_UPDATE_FAILED, 500, error);
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

const stockMovementsRepository = createCrudRepository({
  model: 'sparePartTransaction',
  errors: {
    notFound: ErrorCode.WKS_SPK_TX_NOT_FOUND,
    inUse: ErrorCode.SYS_RECORD_IN_USE,
    createFailed: ErrorCode.WKS_SPK_TX_CREATE_FAILED,
    fetchFailed: ErrorCode.WKS_SPK_TX_FETCH_FAILED,
    updateFailed: ErrorCode.WKS_SPK_TX_CREATE_FAILED,
    deleteFailed: ErrorCode.WKS_SPK_TX_DELETE_FAILED,
  },
  include: PART_NAME,
  list: {
    searchFields: ['sparePart.name', 'sparePart.partNumber', 'referenceNote'],
    sortFields: { id: 'id', quantity: 'quantity', transactionType: 'transactionType', createdAt: 'createdAt' },
    defaultSort: { field: 'id', order: 'desc' },
    filters: { sparePartId: filter.id('sparePartId'), transactionType: filter.equals('transactionType') },
  },
  map: withPartName,
});

export const sparePartTransactionsService = {
  list: stockMovementsRepository.list,
  remove: stockMovementsRepository.remove,

  /** Records a stock movement and adjusts the part's quantity on hand in the same transaction. */
  async create(input: { sparePartId: number; transactionType: string; quantity: number; referenceNote?: string }) {
    const quantity = Math.abs(input.quantity);
    try {
      const row = await prisma.$transaction(async (tx) => {
        if (input.transactionType === 'OUT') {
          await takeFromStock(tx, input.sparePartId, quantity);
        } else {
          await tx.sparePart.update({ where: { id: input.sparePartId }, data: { quantity: { increment: quantity } } });
        }
        return tx.sparePartTransaction.create({
          data: { companyId: currentCompanyId(), sparePartId: input.sparePartId, transactionType: input.transactionType, quantity, referenceNote: input.referenceNote },
          include: PART_NAME,
        });
      });
      return withPartName(row);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if ((error as { code?: string })?.code === 'P2025') throw AppError.from(ErrorCode.WKS_SPK_NOT_FOUND, 404, error);
      throw AppError.from(ErrorCode.WKS_SPK_TX_CREATE_FAILED, 500, error);
    }
  },
};
