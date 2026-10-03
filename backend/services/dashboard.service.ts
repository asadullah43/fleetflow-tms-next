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

/** Spare parts at or below their own minimum stock (a column-to-column comparison, done in the database). */
const lowStockCount = () => prisma.sparePart.count({ where: { quantity: { lte: prisma.sparePart.fields.minimumStock } } });

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
        const [activeTrucks, activeDrivers, tripsThisMonth, openWorkOrders, unpaid, pendingLeaveRequests, lowStockSpareParts] = await Promise.all([
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
          lowStockSpareParts,
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
        const [open, inProgress, completedThisMonth, overdueMaintenance, failedInspections, lowStockSpareParts, expenses, byPriority] = await Promise.all([
          prisma.workOrder.count({ where: { status: 'OPEN' } }),
          prisma.workOrder.count({ where: { status: 'IN_PROGRESS' } }),
          prisma.workOrder.count({ where: { status: 'COMPLETED', completionDate: { gte: monthStart } } }),
          prisma.maintenanceSchedule.count({ where: { status: { not: 'DONE' }, nextService: { lt: today } } }),
          prisma.vehicleInspection.count({ where: { result: 'FAIL' } }),
          lowStockCount(),
          prisma.workshopExpense.aggregate({ where: { expenseDate: { gte: monthStart } }, _sum: { amount: true } }),
          prisma.workOrder.groupBy({ by: ['priority'], where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } }, _count: { _all: true } }),
        ]);
        return {
          openWorkOrders: open,
          inProgressWorkOrders: inProgress,
          completedThisMonth,
          overdueMaintenance,
          failedInspections,
          lowStockSpareParts,
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
