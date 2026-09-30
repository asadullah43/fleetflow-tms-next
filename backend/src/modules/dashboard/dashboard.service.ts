import { prisma } from '../../lib/prisma.js';

/** Direct port of the legacy DashboardService's summary-stats query. */
export const dashboardService = {
  async getSummary() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      activeTrucks,
      activeDrivers,
      tripsThisMonth,
      openWorkOrders,
      unpaidInvoices,
      pendingLeaveRequests,
      spareParts,
    ] = await Promise.all([
      prisma.truck.count({ where: { status: 'ACTIVE' } }),
      prisma.driver.count({ where: { status: 'ACTIVE' } }),
      prisma.trip.count({ where: { tripDate: { gte: startOfMonth } } }),
      prisma.workOrder.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.invoice.aggregate({ where: { status: 'UNPAID' }, _sum: { total: true }, _count: true }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.sparePart.findMany({ select: { quantity: true, minimumStock: true } }),
    ]);

    const lowStockSpareParts = spareParts.filter((p: { quantity: number; minimumStock: number }) => p.quantity <= p.minimumStock).length;

    return {
      activeTrucks,
      activeDrivers,
      tripsThisMonth,
      openWorkOrders,
      unpaidInvoicesTotal: unpaidInvoices._sum.total?.toString() ?? '0',
      unpaidInvoicesCount: unpaidInvoices._count,
      pendingLeaveRequests,
      lowStockSpareParts,
    };
  },
};
