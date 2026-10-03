/**
 * Inventory against a real, migrated PostgreSQL (the services and the
 * tenant-scoped Prisma client, no gRPC server): stock kept per warehouse,
 * the OUT safety check, the low-stock dashboard, and work orders using
 * inventory. Stock rules live in conditional UPDATEs and CHECK
 * constraints, so only a real database can show them working.
 *
 * Needs INTEGRATION_DATABASE_URL: a database `prisma migrate deploy` has
 * run on. Everything is created in a company of its own, removed after.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const DATABASE = process.env.INTEGRATION_DATABASE_URL;
const SKIP = !DATABASE && 'set INTEGRATION_DATABASE_URL to run';
if (DATABASE) process.env.DATABASE_URL = DATABASE;
process.env.DATABASE_URL ??= 'postgresql://unused@127.0.0.1:1/unused';
delete process.env.REDIS_URL;

const { prisma, disconnectDatabase } = await import('../../_core_app_connectivities/prisma.js');
const { runUnscoped, runWithTenant } = await import('../../_core_app_connectivities/tenant-context.js');
const { resetCacheStateForTests, trackRequestWrites, warmUpCache } = await import('../../_core_app_connectivities/cache.js');
const { MemoryStore, setCacheStore } = await import('../../_core_app_connectivities/redis.js');
const { inventoryItemsService, inventoryStockService, inventoryTransactionsService, warehousesService } = await import('../../services/inventory.service.js');
const { workOrderPartsService, workOrdersService } = await import('../../services/workshop.service.js');
const { dashboardService } = await import('../../services/dashboard.service.js');
const { trucksService } = await import('../../services/trucks.service.js');

const stamp = Date.now().toString(36);
let companyId = 0;
/** One request of the company: tenant context, and post-request cache invalidation, as the router gives every RPC. */
const asCompany = <T>(fn: () => Promise<T>) => trackRequestWrites(() => runWithTenant(companyId, fn));
const listQuery = (filters: Record<string, string>) => ({ page: 1, pageSize: 100, search: '', sortBy: '', sortOrder: 'asc' as const, filters });

/** The error code a call fails with ('' if it succeeds). */
async function failure(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return '';
  } catch (error) {
    return (error as { errorCode?: string }).errorCode ?? String(error);
  }
}

/** Quantity of `itemId` per warehouse id, read back through the stock list. */
async function stockOf(itemId: number): Promise<Record<number, number>> {
  const page = await asCompany(() => inventoryStockService.list(listQuery({ itemId: String(itemId) })));
  return Object.fromEntries(page.items.map((row: any) => [row.warehouseId, row.quantity]));
}

async function totalOf(itemId: number): Promise<number> {
  return (await asCompany(() => inventoryItemsService.findOne(itemId))).totalQuantity;
}

describe('inventory (real database)', { skip: SKIP }, () => {
  let main: { id: number };
  let depot: { id: number };
  let empty: { id: number };

  before(async () => {
    // The dashboard is read through the same cache as in production (an in-memory store), so invalidation is exercised too.
    setCacheStore(new MemoryStore());
    resetCacheStateForTests();
    await warmUpCache();
    companyId = (await runUnscoped(() => prisma.company.create({ data: { name: `Inventory test ${stamp}` } }))).id;
    main = await asCompany(() => warehousesService.create({ name: `Main ${stamp}`, location: 'Riyadh' }));
    depot = await asCompany(() => warehousesService.create({ name: `Depot ${stamp}`, location: 'Jeddah' }));
    empty = await asCompany(() => warehousesService.create({ name: `Empty ${stamp}` }));
  });

  after(async () => {
    if (!companyId) return;
    await runUnscoped(async () => {
      const where = { companyId };
      await prisma.inventoryTransaction.deleteMany({ where });
      await prisma.workOrderPart.deleteMany({ where });
      await prisma.inventoryStock.deleteMany({ where });
      await prisma.inventoryItem.deleteMany({ where });
      await prisma.warehouse.deleteMany({ where });
      await prisma.workOrder.deleteMany({ where });
      await prisma.truck.deleteMany({ where });
      await prisma.company.delete({ where: { id: companyId } });
    });
    setCacheStore(null);
    await disconnectDatabase();
  });

  test('the same item is stocked separately per warehouse; IN creates the item the first time', async () => {
    const first = await asCompany(() =>
      inventoryTransactionsService.stockIn({ newItem: { name: `Oil filter ${stamp}`, itemNumber: `OF-${stamp}`, minimumStock: 2, unitCost: '15' }, warehouseId: main.id, quantity: 10 }),
    );
    const itemId = first.itemId;
    await asCompany(() => inventoryTransactionsService.stockIn({ itemId, warehouseId: depot.id, quantity: 3, remarks: 'Opening stock' }));

    assert.deepEqual(await stockOf(itemId), { [main.id]: 10, [depot.id]: 3 }, 'two separate quantities for one item');
    assert.equal(await totalOf(itemId), 13, 'the item total is their sum');
    const ledger = await asCompany(() => inventoryTransactionsService.list(listQuery({ itemId: String(itemId) })));
    assert.deepEqual(ledger.items.map((row: any) => [row.type, row.warehouseId, row.quantity]).sort(), [['IN', depot.id, 3], ['IN', main.id, 10]].sort());
    assert.equal(ledger.items[0].unitCost.toString(), '15', 'movements are valued at the item cost');
  });

  test('an OUT is refused when the chosen warehouse lacks the stock, even though another warehouse has plenty', async () => {
    const { itemId } = await asCompany(() => inventoryTransactionsService.stockIn({ newItem: { name: `Brake pad ${stamp}` }, warehouseId: main.id, quantity: 50 }));
    await asCompany(() => inventoryTransactionsService.stockIn({ itemId, warehouseId: depot.id, quantity: 2 }));

    assert.equal(await failure(() => asCompany(() => inventoryTransactionsService.stockOut({ itemId, warehouseId: depot.id, quantity: 3, remarks: 'too many' }))), 'FLEET-STK015');
    assert.equal(await failure(() => asCompany(() => inventoryTransactionsService.stockOut({ itemId, warehouseId: empty.id, quantity: 1 }))), 'FLEET-STK015', 'a warehouse that never held the item');
    assert.deepEqual(await stockOf(itemId), { [main.id]: 50, [depot.id]: 2 }, 'a refused OUT changes nothing');
    assert.equal(await totalOf(itemId), 52);
    const outs = await asCompany(() => inventoryTransactionsService.list(listQuery({ itemId: String(itemId), type: 'OUT' })));
    assert.equal(outs.pagination.totalItems, 0, 'and leaves no ledger entry');

    // Taking exactly what is there works, with the remarks kept.
    const out = await asCompany(() => inventoryTransactionsService.stockOut({ itemId, warehouseId: depot.id, quantity: 2, remarks: 'used for Truck TRK-003' }));
    assert.deepEqual([out.type, out.quantity, out.remarks], ['OUT', 2, 'used for Truck TRK-003']);
    assert.deepEqual(await stockOf(itemId), { [main.id]: 50, [depot.id]: 0 });
    assert.equal(await totalOf(itemId), 50);

    // Simultaneous OUTs cannot together take more than the warehouse holds.
    const racers = await Promise.allSettled(Array.from({ length: 6 }, () => asCompany(() => inventoryTransactionsService.stockOut({ itemId, warehouseId: main.id, quantity: 10 }))));
    assert.equal(racers.filter((result) => result.status === 'fulfilled').length, 5);
    assert.deepEqual(await stockOf(itemId), { [main.id]: 0, [depot.id]: 0 });
    assert.equal(await totalOf(itemId), 0);
  });

  test('low stock: items at or below their minimum across all warehouses, on the dashboard and its list filter', async () => {
    const low = (await asCompany(() => inventoryTransactionsService.stockIn({ newItem: { name: `Wiper ${stamp}`, minimumStock: 8 }, warehouseId: main.id, quantity: 5 }))).itemId;
    await asCompany(() => inventoryTransactionsService.stockIn({ itemId: low, warehouseId: depot.id, quantity: 3 })); // 8 in all = the minimum: low
    // Below the minimum in each warehouse, but not in total: not low (the minimum is per item, compared with its total).
    const spread = (await asCompany(() => inventoryTransactionsService.stockIn({ newItem: { name: `Fan belt ${stamp}`, minimumStock: 5 }, warehouseId: main.id, quantity: 3 }))).itemId;
    await asCompany(() => inventoryTransactionsService.stockIn({ itemId: spread, warehouseId: depot.id, quantity: 3 }));
    const fine = (await asCompany(() => inventoryTransactionsService.stockIn({ newItem: { name: `Battery ${stamp}`, minimumStock: 1 }, warehouseId: depot.id, quantity: 9 }))).itemId;
    // A discontinued item is not reordered, so it never counts as low.
    const retired = await asCompany(() => inventoryItemsService.create({ name: `Old part ${stamp}`, minimumStock: 4, status: 'DISCONTINUED' }));

    const summary = await asCompany(() => dashboardService.getInventorySummary());
    const lowIds = summary.lowStock.map((row: any) => row.itemId);
    assert.ok(lowIds.includes(low), 'at its minimum');
    assert.ok(!lowIds.includes(spread) && !lowIds.includes(fine) && !lowIds.includes(retired.id));
    const lowRow = summary.lowStock.find((row: any) => row.itemId === low);
    assert.deepEqual([lowRow?.totalQuantity, lowRow?.minimumStock], [8, 8]);
    assert.equal(summary.lowStockItems, summary.lowStock.length);
    assert.equal((await asCompany(() => dashboardService.getSummary())).lowStockItems, summary.lowStockItems, 'the operations tab counts the same items');

    // Stock per warehouse per item.
    const level = (itemId: number, warehouseId: number) => summary.stockLevels.find((row: any) => row.itemId === itemId && row.warehouseId === warehouseId)?.quantity;
    assert.deepEqual([level(low, main.id), level(low, depot.id), level(spread, main.id), level(spread, depot.id), level(fine, depot.id)], [5, 3, 3, 3, 9]);
    assert.equal(summary.stockLevels.find((row: any) => row.itemId === fine && row.warehouseId === main.id), undefined, 'warehouses without the item are not listed for it');
    const depotRow = summary.byWarehouse.find((row: any) => row.warehouseId === depot.id);
    assert.ok((depotRow?.units ?? 0) >= 3 + 3 + 9);

    const filtered = await asCompany(() => inventoryItemsService.list(listQuery({ lowStock: 'LOW_STOCK' })));
    assert.ok(filtered.items.some((row: any) => row.id === low) && !filtered.items.some((row: any) => row.id === spread));

    // A receipt lifts it above the minimum, and the (cached) dashboard shows that on the very next read.
    await asCompany(() => inventoryTransactionsService.stockIn({ itemId: low, warehouseId: main.id, quantity: 1 }));
    const after = await asCompany(() => dashboardService.getInventorySummary());
    assert.ok(!after.lowStock.some((row: any) => row.itemId === low));
    assert.equal(after.lowStockItems, summary.lowStockItems - 1);
  });

  test('a work order uses inventory from the chosen warehouse only, and the cost goes onto the work order', async () => {
    const truck = await asCompany(() => trucksService.create({ truckNumber: `INV-${stamp}` }));
    const order = await asCompany(() => workOrdersService.create({ truckId: truck.id, issue: 'Brake service', laborCost: '100', otherCost: '0' }));
    assert.deepEqual([order.partsCost.toString(), order.totalCost.toString()], ['0', '100']);
    const itemId = (await asCompany(() => inventoryTransactionsService.stockIn({ newItem: { name: `Brake disc ${stamp}`, unitCost: '12.50' }, warehouseId: main.id, quantity: 10 }))).itemId;
    await asCompany(() => inventoryTransactionsService.stockIn({ itemId, warehouseId: depot.id, quantity: 4 }));

    const line = await asCompany(() => workOrderPartsService.create({ workOrderId: order.id, itemId, warehouseId: depot.id, quantity: 3 }));
    assert.deepEqual([line.warehouseId, line.quantity, line.unitCost.toString(), line.totalCost.toString()], [depot.id, 3, '12.5', '37.5']);
    assert.deepEqual(await stockOf(itemId), { [main.id]: 10, [depot.id]: 1 }, 'taken from the chosen warehouse only');
    assert.equal(await totalOf(itemId), 11);
    let saved = await asCompany(() => workOrdersService.findOne(order.id));
    assert.deepEqual([saved.partsCost.toString(), saved.totalCost.toString()], ['37.5', '137.5'], 'parts cost and total include the line');
    const used = await asCompany(() => inventoryTransactionsService.list(listQuery({ workOrderId: String(order.id) })));
    assert.deepEqual(used.items.map((row: any) => [row.type, row.warehouseId, row.quantity, row.workOrderNumber]), [['OUT', depot.id, 3, order.orderNumber]], 'recorded in the ledger against the work order');

    // The chosen warehouse has 1 left: refused, although the main warehouse has 10. Nothing changes.
    assert.equal(await failure(() => asCompany(() => workOrderPartsService.create({ workOrderId: order.id, itemId, warehouseId: depot.id, quantity: 2 }))), 'FLEET-STK015');
    saved = await asCompany(() => workOrdersService.findOne(order.id));
    assert.deepEqual([saved.partsCost.toString(), saved.totalCost.toString()], ['37.5', '137.5']);
    assert.deepEqual(await stockOf(itemId), { [main.id]: 10, [depot.id]: 1 });

    // Removing the line puts the stock back where it came from and takes the amount off the work order.
    await asCompany(() => workOrderPartsService.remove(line.id));
    assert.deepEqual(await stockOf(itemId), { [main.id]: 10, [depot.id]: 4 });
    assert.equal(await totalOf(itemId), 14);
    saved = await asCompany(() => workOrdersService.findOne(order.id));
    assert.deepEqual([saved.partsCost.toString(), saved.totalCost.toString()], ['0', '100']);
    const ledger = await asCompany(() => inventoryTransactionsService.list(listQuery({ workOrderId: String(order.id) })));
    assert.deepEqual(ledger.items.map((row: any) => row.type).sort(), ['IN', 'OUT']);
  });

  test('stock cannot be moved into another company, and the database itself refuses negative stock', async () => {
    const own = (await asCompany(() => inventoryTransactionsService.stockIn({ newItem: { name: `Fuse ${stamp}` }, warehouseId: main.id, quantity: 1 }))).itemId;
    const other = await runUnscoped(() => prisma.company.findFirst({ where: { id: { not: companyId } }, select: { id: true } }));
    if (other) {
      const theirs = await runWithTenant(other.id, () => prisma.warehouse.findFirst({ select: { id: true } }));
      if (theirs) assert.equal(await failure(() => asCompany(() => inventoryTransactionsService.stockIn({ itemId: own, warehouseId: theirs.id, quantity: 1 }))), 'FLEET-SYS006');
    }
    // Even a write that bypassed takeFromStock could not push a quantity below zero (CHECK constraint).
    await assert.rejects(runUnscoped(() => prisma.inventoryStock.updateMany({ where: { itemId: own }, data: { quantity: -1 } })));
    assert.deepEqual(await stockOf(own), { [main.id]: 1 });
  });

  test('a work order with inventory lines cannot be deleted until the lines are removed (which returns their stock)', async () => {
    const truck = await asCompany(() => trucksService.create({ truckNumber: `DEL-${stamp}` }));
    const order = await asCompany(() => workOrdersService.create({ truckId: truck.id, issue: 'Clutch' }));
    const itemId = (await asCompany(() => inventoryTransactionsService.stockIn({ newItem: { name: `Clutch plate ${stamp}`, unitCost: '40' }, warehouseId: main.id, quantity: 5 }))).itemId;
    const line = await asCompany(() => workOrderPartsService.create({ workOrderId: order.id, itemId, warehouseId: main.id, quantity: 2 }));

    assert.equal(await failure(() => asCompany(() => workOrdersService.remove(order.id))), 'FLEET-WKS036', 'refused while it has inventory lines');
    assert.equal((await asCompany(() => workOrdersService.findOne(order.id))).orderNumber, order.orderNumber, 'the order is still there');
    assert.deepEqual(await stockOf(itemId), { [main.id]: 3 }, 'and its stock stays used, not silently kept or lost');

    await asCompany(() => workOrderPartsService.remove(line.id));
    assert.deepEqual(await stockOf(itemId), { [main.id]: 5 }, 'removing the line returned the stock');
    await asCompany(() => workOrdersService.remove(order.id));
    assert.equal(await failure(() => asCompany(() => workOrdersService.findOne(order.id))), 'FLEET-WKS001', 'the now-empty order is deleted');
  });

  test('IN and OUT carry the date the stock moved, separate from when they were recorded (today by default)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const received = await asCompany(() => inventoryTransactionsService.stockIn({ newItem: { name: `Hose ${stamp}` }, warehouseId: depot.id, quantity: 6, movementDate: '2026-09-15' }));
    assert.equal(new Date(received.movementDate).toISOString().slice(0, 10), '2026-09-15');
    assert.equal(new Date(received.createdAt).toISOString().slice(0, 10), today, 'createdAt is still when it was entered');

    const issued = await asCompany(() => inventoryTransactionsService.stockOut({ itemId: received.itemId, warehouseId: depot.id, quantity: 1, movementDate: '2026-09-20' }));
    assert.equal(new Date(issued.movementDate).toISOString().slice(0, 10), '2026-09-20');
    const undated = await asCompany(() => inventoryTransactionsService.stockOut({ itemId: received.itemId, warehouseId: depot.id, quantity: 1 }));
    assert.equal(new Date(undated.movementDate).toISOString().slice(0, 10), today, 'no date given: today');

    // The history lists movements by that date (newest first) and filters on it.
    const history = await asCompany(() => inventoryTransactionsService.list(listQuery({ itemId: String(received.itemId) })));
    assert.deepEqual(history.items.map((row: any) => row.id), [undated.id, issued.id, received.id]);
    const september = await asCompany(() => inventoryTransactionsService.list(listQuery({ itemId: String(received.itemId), fromDate: '2026-09-01', toDate: '2026-09-30' })));
    assert.deepEqual(september.items.map((row: any) => row.id).sort(), [issued.id, received.id].sort());
  });

  test('a work order can be created with inventory lines in one step: all taken from stock, or nothing created', async () => {
    const truck = await asCompany(() => trucksService.create({ truckNumber: `NEW-${stamp}` }));
    const bolt = (await asCompany(() => inventoryTransactionsService.stockIn({ newItem: { name: `Bolt ${stamp}`, unitCost: '1.25' }, warehouseId: main.id, quantity: 10 }))).itemId;
    const nut = (await asCompany(() => inventoryTransactionsService.stockIn({ newItem: { name: `Nut ${stamp}`, unitCost: '0.50' }, warehouseId: depot.id, quantity: 3 }))).itemId;

    // One line short (the depot holds 3 nuts): refused, and nothing happens — no order, no stock taken.
    const ordersBefore = await runWithTenant(companyId, () => prisma.workOrder.count());
    const short = await failure(() =>
      asCompany(() =>
        workOrdersService.create({ truckId: truck.id, issue: 'Wheel', laborCost: '20', parts: [{ itemId: bolt, warehouseId: main.id, quantity: 4 }, { itemId: nut, warehouseId: depot.id, quantity: 5 }] }),
      ),
    );
    assert.equal(short, 'FLEET-STK015');
    assert.equal(await runWithTenant(companyId, () => prisma.workOrder.count()), ordersBefore, 'no work order was created');
    assert.deepEqual([await stockOf(bolt), await stockOf(nut)], [{ [main.id]: 10 }, { [depot.id]: 3 }], 'and no stock was taken');

    const order = await asCompany(() =>
      workOrdersService.create({ truckId: truck.id, issue: 'Wheel', laborCost: '20', partsCost: '3', parts: [{ itemId: bolt, warehouseId: main.id, quantity: 4 }, { itemId: nut, warehouseId: depot.id, quantity: 2 }] }),
    );
    // 4 × 1.25 + 2 × 0.50 = 6, on top of the 3 entered by hand.
    assert.deepEqual([order.partsCost.toString(), order.totalCost.toString()], ['9', '29']);
    assert.deepEqual([await stockOf(bolt), await stockOf(nut)], [{ [main.id]: 6 }, { [depot.id]: 1 }], 'each line taken from its own warehouse');
    const lines = await asCompany(() => workOrderPartsService.list(listQuery({ workOrderId: String(order.id) })));
    assert.deepEqual(lines.items.map((row: any) => [row.itemId, row.warehouseId, row.quantity, row.totalCost.toString()]).sort(), [[bolt, main.id, 4, '5'], [nut, depot.id, 2, '1']].sort());
    const ledger = await asCompany(() => inventoryTransactionsService.list(listQuery({ workOrderId: String(order.id) })));
    assert.deepEqual(ledger.items.map((row: any) => [row.type, row.remarks]), [['OUT', `Used on work order ${order.orderNumber}`], ['OUT', `Used on work order ${order.orderNumber}`]]);

    // The same rules as lines added later: the order cannot be deleted while it has them; removing one reverses it.
    assert.equal(await failure(() => asCompany(() => workOrdersService.remove(order.id))), 'FLEET-WKS036');
    const nutLine = lines.items.find((row: any) => row.itemId === nut);
    await asCompany(() => workOrderPartsService.remove(nutLine.id));
    assert.deepEqual(await stockOf(nut), { [depot.id]: 3 });
    const saved = await asCompany(() => workOrdersService.findOne(order.id));
    assert.deepEqual([saved.partsCost.toString(), saved.totalCost.toString()], ['8', '28']);
  });
});
