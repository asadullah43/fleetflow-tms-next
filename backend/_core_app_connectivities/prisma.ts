/**
 * PROTECTED CORE CONNECTIVITY — the single PostgreSQL connection for the
 * whole process. Do not create another PrismaClient anywhere else; import
 * `prisma` from here.
 *
 * `prisma` is tenant-scoped: for every model that has a `companyId`, each
 * query is automatically restricted to (and each new row stamped with)
 * the current request's company from tenant-context.ts, and any foreign
 * key written is verified to point at a row of the same company. A query
 * on a tenant model with no tenant context throws instead of silently
 * running across companies.
 */
// The "prisma-client" generator outputs client.ts as its entry point.
import { PrismaClient } from '../generated/prisma/client.js';
import { getTenantContext } from './tenant-context.js';
import { AppError } from '../classes/app-error.js';
import { ErrorCode } from '../global_config/error-codes.js';

const base = new PrismaClient();

/** Every model with a companyId column (kept in sync with schema.prisma by test/tenancy-map.test.ts). */
export const TENANT_MODELS: ReadonlySet<string> = new Set([
  'Truck',
  'TruckDriverAssignment',
  'Driver',
  'Supplier',
  'Customer',
  'Location',
  'CargoType',
  'Trip',
  'RateContract',
  'Invoice',
  'CompanySettings',
  'SupplierPayment',
  'LoadingOrder',
  'User',
  'Role',
  'WorkOrder',
  'WorkOrderPart',
  'MaintenanceSchedule',
  'VehicleInspection',
  'InspectionItem',
  'SparePart',
  'SparePartTransaction',
  'WorkshopExpense',
  'Department',
  'Designation',
  'Employee',
  'Attendance',
  'LeaveRequest',
  'EmployeeDocument',
  'EmploymentContract',
  'ApiKey',
  'IdempotencyRecord',
]);

/** model -> { foreign-key column: client delegate of the tenant model it references } */
export const TENANT_REFERENCES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  TruckDriverAssignment: { truckId: 'truck', driverId: 'driver' },
  Trip: {
    supplierId: 'supplier',
    customerId: 'customer',
    pickupLocationId: 'location',
    deliveryLocationId: 'location',
    cargoTypeId: 'cargoType',
    truckId: 'truck',
    driverId: 'driver',
    invoiceId: 'invoice',
  },
  RateContract: { customerId: 'customer', pickupLocationId: 'location', deliveryLocationId: 'location', cargoTypeId: 'cargoType' },
  Invoice: { customerId: 'customer' },
  SupplierPayment: { supplierId: 'supplier' },
  LoadingOrder: { pickupLocationId: 'location', deliveryLocationId: 'location', customerId: 'customer', cargoTypeId: 'cargoType' },
  User: { roleId: 'role' },
  WorkOrder: { truckId: 'truck', driverId: 'driver', supplierId: 'supplier' },
  WorkOrderPart: { workOrderId: 'workOrder', sparePartId: 'sparePart' },
  MaintenanceSchedule: { truckId: 'truck' },
  VehicleInspection: { truckId: 'truck', inspectorId: 'user' },
  InspectionItem: { inspectionId: 'vehicleInspection', workOrderId: 'workOrder' },
  SparePart: { supplierId: 'supplier' },
  SparePartTransaction: { sparePartId: 'sparePart' },
  WorkshopExpense: { truckId: 'truck', workOrderId: 'workOrder' },
  Designation: { departmentId: 'department' },
  Employee: { departmentId: 'department', designationId: 'designation', driverId: 'driver' },
  Attendance: { employeeId: 'employee' },
  LeaveRequest: { employeeId: 'employee' },
  EmployeeDocument: { employeeId: 'employee' },
  EmploymentContract: { employeeId: 'employee' },
};

type CountDelegate = { count(args: { where: { id: number; companyId: number } }): Promise<number> };

/** Rejects a write whose foreign keys point at another company's rows (or at nothing). */
async function assertSameTenantReferences(model: string, data: unknown, companyId: number): Promise<void> {
  const references = TENANT_REFERENCES[model];
  if (!references || !data || typeof data !== 'object') return;
  const row = data as Record<string, unknown>;
  await Promise.all(
    Object.entries(references).map(async ([column, delegate]) => {
      const id = row[column];
      if (typeof id !== 'number') return; // not being set (undefined) or being cleared (null)
      const found = await (base as unknown as Record<string, CountDelegate>)[delegate].count({ where: { id, companyId } });
      if (found === 0) throw AppError.from(ErrorCode.SYS_INVALID_REFERENCE, 400);
    }),
  );
}

const WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
]);

export const prisma = base.$extends({
  name: 'tenant-scope',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!TENANT_MODELS.has(model)) return query(args);
        const ctx = getTenantContext();
        if (ctx?.unscoped) return query(args);
        if (!ctx || ctx.companyId === null) {
          throw new Error(`Tenant context missing for ${model}.${operation}`);
        }
        const companyId = ctx.companyId;
        const a = (args ?? {}) as Record<string, any>;

        if (WHERE_OPERATIONS.has(operation)) {
          a.where = { ...(a.where ?? {}), companyId };
        }
        if (operation === 'create') {
          a.data = { ...a.data, companyId };
          await assertSameTenantReferences(model, a.data, companyId);
        } else if (operation === 'createMany' || operation === 'createManyAndReturn') {
          const rows = (Array.isArray(a.data) ? a.data : [a.data]).map((row: object) => ({ ...row, companyId }));
          for (const row of rows) await assertSameTenantReferences(model, row, companyId);
          a.data = rows;
        } else if (operation === 'update' || operation === 'updateMany' || operation === 'updateManyAndReturn') {
          // A row can never be moved to another company.
          if (a.data && typeof a.data === 'object') delete a.data.companyId;
          await assertSameTenantReferences(model, a.data, companyId);
        } else if (operation === 'upsert') {
          a.where = { ...(a.where ?? {}), companyId };
          a.create = { ...a.create, companyId };
          if (a.update && typeof a.update === 'object') delete a.update.companyId;
          await assertSameTenantReferences(model, a.create, companyId);
          await assertSameTenantReferences(model, a.update, companyId);
        }
        return query(a as typeof args);
      },
    },
  },
});

export type TenantPrisma = typeof prisma;

export async function disconnectDatabase(): Promise<void> {
  await base.$disconnect();
}
