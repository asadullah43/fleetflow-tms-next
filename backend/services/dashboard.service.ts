import { cachedRead } from '../_core_app_connectivities/cache.js';
import { prisma } from '../_core_app_connectivities/prisma.js';
import { AppError } from '../classes/app-error.js';
import { ErrorCode } from '../global_config/error-codes.js';
import { config } from '../global_config/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfMonth(): Date {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Figures depend on the date ("this month", "today"), so cached ones are kept per local day. */
const cacheDay = () => ({ day: startOfToday().toISOString() });

/**
 * Low stock: an active item whose total across ALL warehouses is at or
 * below its minimum. The minimum is set per item, so it is compared with
 * the item's total; the per-warehouse split is shown alongside on the
 * inventory dashboard. A column-to-column comparison, done in the database.
 */
const LOW_STOCK = () => ({ status: 'ACTIVE', totalQuantity: { lte: prisma.inventoryItem.fields.minimumStock } });
const lowStockCount = () => prisma.inventoryItem.count({ where: LOW_STOCK() });

/** How many rows the inventory dashboard lists (each list has a "see all" link to its full page). */
const STOCK_LEVEL_ROWS = 50;
const LOW_STOCK_ROWS = 20;

const OPEN_WORK_ORDER = { status: { in: ['OPEN', 'IN_PROGRESS'] } };

/**
 * Dashboard figures. Every number is a database count/sum scoped to the
 * caller's company — the frontend no longer downloads whole tables to
 * count rows in the browser.
 */
export const dashboardService = {
  async getSummary() {
    return cachedRead('dashboard.operations', cacheDay(), config.cache.dashboardTtlSeconds, async () => {
      try {
        const [activeTrucks, activeDrivers, tripsThisMonth, openWorkOrders, unpaid, pendingLeaveRequests, lowStockItems] = await Promise.all([
          prisma.truck.count({ where: { status: 'ACTIVE' } }),
          prisma.driver.count({ where: { status: 'ACTIVE' } }),
          prisma.trip.count({ where: { tripDate: { gte: startOfMonth() } } }),
          prisma.workOrder.count({ where: OPEN_WORK_ORDER }),
          prisma.invoice.aggregate({ where: { status: 'UNPAID' }, _sum: { total: true }, _count: true }),
          prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
          lowStockCount(),
        ]);
        return {
          activeTrucks,
          activeDrivers,
          tripsThisMonth,
          openWorkOrders,
          unpaidInvoicesTotal: unpaid._sum.total?.toString() ?? '0',
          unpaidInvoicesCount: unpaid._count,
          pendingLeaveRequests,
          lowStockItems,
        };
      } catch (error) {
        throw AppError.from(ErrorCode.DSH_FETCH_FAILED, 500, error);
      }
    });
  },

  async getHrSummary() {
    return cachedRead('dashboard.hr', cacheDay(), config.cache.dashboardTtlSeconds, async () => {
      try {
        const today = startOfToday();
        const tomorrow = new Date(today.getTime() + DAY_MS);
        const in30Days = new Date(today.getTime() + 31 * DAY_MS);
        const todays = { attendDate: { gte: today, lt: tomorrow } };

        const [byStatus, departments, presentToday, absentToday, lateToday, pendingLeaveRequests, contractsExpiring, byDepartment] = await Promise.all([
          prisma.employee.groupBy({ by: ['employmentStatus'], _count: { _all: true } }),
          prisma.department.findMany({ select: { id: true, name: true, nameAr: true } }),
          prisma.attendance.count({ where: { ...todays, status: 'PRESENT' } }),
          prisma.attendance.count({ where: { ...todays, status: 'ABSENT' } }),
          prisma.attendance.count({ where: { ...todays, status: { in: ['LATE', 'HALF_DAY'] } } }),
          prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
          prisma.employmentContract.count({ where: { status: 'ACTIVE', endDate: { gte: today, lt: in30Days } } }),
          prisma.employee.groupBy({ by: ['departmentId'], _count: { _all: true } }),
        ]);

        const statusCount = (status: string) => byStatus.find((row) => row.employmentStatus === status)?._count._all ?? 0;
        const departmentById = new Map(departments.map((d) => [d.id, d]));
        const headcountByDepartment = byDepartment
          .map((row) => {
            const department = departmentById.get(row.departmentId);
            return { label: department?.name ?? 'Unassigned', labelAr: department?.nameAr ?? undefined, count: row._count._all };
          })
          .sort((a, b) => b.count - a.count);

        return {
          totalEmployees: byStatus.reduce((sum, row) => sum + row._count._all, 0),
          activeEmployees: statusCount('ACTIVE'),
          onLeaveEmployees: statusCount('ON_LEAVE'),
          terminatedEmployees: statusCount('TERMINATED'),
          departments: departments.length,
          presentToday,
          absentToday,
          lateToday,
          pendingLeaveRequests,
          contractsExpiring,
          headcountByDepartment,
        };
      } catch (error) {
        throw AppError.from(ErrorCode.DSH_HR_FETCH_FAILED, 500, error);
      }
    });
  },

  async getWorkshopSummary() {
    return cachedRead('dashboard.workshop', cacheDay(), config.cache.dashboardTtlSeconds, async () => {
      try {
        const today = startOfToday();
        const monthStart = startOfMonth();
        const [open, inProgress, completedThisMonth, overdueMaintenance, failedInspections, expenses, byPriority] = await Promise.all([
          prisma.workOrder.count({ where: { status: 'OPEN' } }),
          prisma.workOrder.count({ where: { status: 'IN_PROGRESS' } }),
          prisma.workOrder.count({ where: { status: 'COMPLETED', completionDate: { gte: monthStart } } }),
          prisma.maintenanceSchedule.count({ where: { status: { not: 'DONE' }, nextService: { lt: today } } }),
          prisma.vehicleInspection.count({ where: { result: 'FAIL' } }),
          prisma.workshopExpense.aggregate({ where: { expenseDate: { gte: monthStart } }, _sum: { amount: true } }),
          prisma.workOrder.groupBy({ by: ['priority'], where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } }, _count: { _all: true } }),
        ]);
        return {
          openWorkOrders: open,
          inProgressWorkOrders: inProgress,
          completedThisMonth,
          overdueMaintenance,
          failedInspections,
          expensesThisMonth: expenses._sum.amount?.toFixed(2) ?? '0.00',
          openByPriority: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((priority) => ({
            label: priority,
            count: byPriority.find((row) => row.priority === priority)?._count._all ?? 0,
          })),
        };
      } catch (error) {
        throw AppError.from(ErrorCode.WKS_DASH_FETCH_FAILED, 500, error);
      }
    });
  },

  /** Stock per warehouse and per item, and the items at or below their minimum (see LOW_STOCK). */
  async getInventorySummary() {
    return cachedRead('dashboard.inventory', cacheDay(), config.cache.dashboardTtlSeconds, async () => {
      try {
        const inStock = { quantity: { gt: 0 } };
        const [activeItems, warehouses, totals, byWarehouse, stockLevels, stockLevelsTotal, lowStockItems, lowStock] = await Promise.all([
          prisma.inventoryItem.count({ where: { status: 'ACTIVE' } }),
          prisma.warehouse.findMany({ select: { id: true, name: true, nameAr: true, status: true }, orderBy: { name: 'asc' } }),
          prisma.inventoryStock.aggregate({ _sum: { quantity: true } }),
          prisma.inventoryStock.groupBy({ by: ['warehouseId'], where: inStock, _sum: { quantity: true }, _count: { _all: true } }),
          prisma.inventoryStock.findMany({
            where: inStock,
            select: { quantity: true, warehouseId: true, itemId: true, warehouse: { select: { name: true, nameAr: true } }, item: { select: { name: true, nameAr: true, itemNumber: true } } },
            orderBy: [{ warehouse: { name: 'asc' } }, { item: { name: 'asc' } }, { id: 'asc' }],
            take: STOCK_LEVEL_ROWS,
          }),
          prisma.inventoryStock.count({ where: inStock }),
          lowStockCount(),
          prisma.inventoryItem.findMany({
            where: LOW_STOCK(),
            select: { id: true, name: true, nameAr: true, itemNumber: true, totalQuantity: true, minimumStock: true },
            orderBy: [{ totalQuantity: 'asc' }, { name: 'asc' }],
            take: LOW_STOCK_ROWS,
          }),
        ]);

        const perWarehouse = new Map(byWarehouse.map((row) => [row.warehouseId, row]));
        return {
          activeItems,
          activeWarehouses: warehouses.filter((warehouse) => warehouse.status === 'ACTIVE').length,
          totalUnits: totals._sum.quantity ?? 0,
          lowStockItems,
          // Every active warehouse, plus any inactive one still holding stock.
          byWarehouse: warehouses
            .filter((warehouse) => warehouse.status === 'ACTIVE' || perWarehouse.has(warehouse.id))
            .map((warehouse) => ({
              warehouseId: warehouse.id,
              name: warehouse.name,
              nameAr: warehouse.nameAr ?? undefined,
              items: perWarehouse.get(warehouse.id)?._count._all ?? 0,
              units: perWarehouse.get(warehouse.id)?._sum.quantity ?? 0,
            })),
          stockLevels: stockLevels.map((row) => ({
            warehouseId: row.warehouseId,
            warehouseName: row.warehouse.name,
            warehouseNameAr: row.warehouse.nameAr ?? undefined,
            itemId: row.itemId,
            itemName: row.item.name,
            itemNameAr: row.item.nameAr ?? undefined,
            itemNumber: row.item.itemNumber ?? undefined,
            quantity: row.quantity,
          })),
          stockLevelsTotal,
          lowStock: lowStock.map((item) => ({
            itemId: item.id,
            name: item.name,
            nameAr: item.nameAr ?? undefined,
            itemNumber: item.itemNumber ?? undefined,
            totalQuantity: item.totalQuantity,
            minimumStock: item.minimumStock,
          })),
        };
      } catch (error) {
        throw AppError.from(ErrorCode.STK_DASH_FETCH_FAILED, 500, error);
      }
    });
  },

  async getFleetSummary() {
    return cachedRead('dashboard.fleet', cacheDay(), config.cache.dashboardTtlSeconds, async () => {
      try {
        const [fleetSize, activeTrucks] = await Promise.all([prisma.truck.count(), prisma.truck.count({ where: { status: 'ACTIVE' } })]);
        return { fleetSize, activeTrucks };
      } catch (error) {
        throw AppError.from(ErrorCode.DSH_FETCH_FAILED, 500, error);
      }
    });
  },
};
