/**
 * model -> { relation field: related model }, for every relation in
 * prisma/schema.prisma (kept in sync by test/cache.test.ts). The read
 * cache uses it to see which tables a query touches — through include,
 * select, relation filters and sorts, and nested writes — so a cached
 * page that shows a customer's name is invalidated when that customer
 * is renamed, not only when the page's own table changes.
 */
export const MODEL_RELATIONS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  Truck: { trips: 'Trip', assignments: 'TruckDriverAssignment', workOrders: 'WorkOrder', maintenanceSchedules: 'MaintenanceSchedule', inspections: 'VehicleInspection', expenses: 'WorkshopExpense', company: 'Company' },
  TruckDriverAssignment: { truck: 'Truck', driver: 'Driver', company: 'Company' },
  Driver: { trips: 'Trip', assignments: 'TruckDriverAssignment', workOrders: 'WorkOrder', employee: 'Employee', company: 'Company' },
  Supplier: { trips: 'Trip', payments: 'SupplierPayment', workOrders: 'WorkOrder', inventoryItems: 'InventoryItem', company: 'Company' },
  Customer: { trips: 'Trip', rateContracts: 'RateContract', invoices: 'Invoice', loadingOrders: 'LoadingOrder', company: 'Company' },
  Location: {
    pickupTrips: 'Trip',
    deliveryTrips: 'Trip',
    rateContractsAsPickup: 'RateContract',
    rateContractsAsDelivery: 'RateContract',
    loadingOrdersAsPickup: 'LoadingOrder',
    loadingOrdersAsDelivery: 'LoadingOrder',
    company: 'Company',
  },
  CargoType: { trips: 'Trip', rateContracts: 'RateContract', loadingOrders: 'LoadingOrder', company: 'Company' },
  Trip: { supplier: 'Supplier', customer: 'Customer', pickupLocation: 'Location', deliveryLocation: 'Location', cargoType: 'CargoType', truck: 'Truck', driver: 'Driver', invoice: 'Invoice', company: 'Company' },
  RateContract: { customer: 'Customer', pickupLocation: 'Location', deliveryLocation: 'Location', cargoType: 'CargoType', company: 'Company' },
  Invoice: { customer: 'Customer', lineItems: 'InvoiceLineItem', trips: 'Trip', zatcaSubmissionLogs: 'ZatcaSubmissionLog', company: 'Company' },
  InvoiceLineItem: { invoice: 'Invoice' },
  CompanySettings: { company: 'Company' },
  ZatcaSubmissionLog: { invoice: 'Invoice' },
  SupplierPayment: { supplier: 'Supplier', company: 'Company' },
  LoadingOrder: { pickupLocation: 'Location', deliveryLocation: 'Location', customer: 'Customer', cargoType: 'CargoType', company: 'Company' },
  User: { roleRef: 'Role', inspections: 'VehicleInspection', company: 'Company' },
  Role: { permissions: 'Permission', users: 'User', company: 'Company' },
  Permission: { role: 'Role' },
  WorkOrder: { truck: 'Truck', driver: 'Driver', supplier: 'Supplier', parts: 'WorkOrderPart', inspectionItems: 'InspectionItem', expenses: 'WorkshopExpense', inventoryTransactions: 'InventoryTransaction', company: 'Company' },
  WorkOrderPart: { workOrder: 'WorkOrder', item: 'InventoryItem', warehouse: 'Warehouse', company: 'Company' },
  MaintenanceSchedule: { truck: 'Truck', company: 'Company' },
  VehicleInspection: { truck: 'Truck', inspector: 'User', items: 'InspectionItem', company: 'Company' },
  InspectionItem: { inspection: 'VehicleInspection', workOrder: 'WorkOrder', company: 'Company' },
  WorkshopExpense: { truck: 'Truck', workOrder: 'WorkOrder', company: 'Company' },
  Department: { designations: 'Designation', employees: 'Employee', company: 'Company' },
  Designation: { department: 'Department', employees: 'Employee', company: 'Company' },
  Employee: {
    department: 'Department',
    designation: 'Designation',
    driver: 'Driver',
    attendance: 'Attendance',
    leaveRequests: 'LeaveRequest',
    documents: 'EmployeeDocument',
    contracts: 'EmploymentContract',
    company: 'Company',
  },
  Attendance: { employee: 'Employee', company: 'Company' },
  LeaveRequest: { employee: 'Employee', company: 'Company' },
  EmployeeDocument: { employee: 'Employee', file: 'StoredFile', company: 'Company' },
  EmploymentContract: { employee: 'Employee', documentFile: 'StoredFile', company: 'Company' },
  Company: {
    trucks: 'Truck',
    truckDriverAssignments: 'TruckDriverAssignment',
    drivers: 'Driver',
    suppliers: 'Supplier',
    customers: 'Customer',
    locations: 'Location',
    cargoTypes: 'CargoType',
    trips: 'Trip',
    rateContracts: 'RateContract',
    invoices: 'Invoice',
    settings: 'CompanySettings',
    supplierPayments: 'SupplierPayment',
    loadingOrders: 'LoadingOrder',
    users: 'User',
    roles: 'Role',
    workOrders: 'WorkOrder',
    workOrderParts: 'WorkOrderPart',
    maintenanceSchedules: 'MaintenanceSchedule',
    vehicleInspections: 'VehicleInspection',
    inspectionItems: 'InspectionItem',
    workshopExpenses: 'WorkshopExpense',
    departments: 'Department',
    designations: 'Designation',
    employees: 'Employee',
    attendances: 'Attendance',
    leaveRequests: 'LeaveRequest',
    employeeDocuments: 'EmployeeDocument',
    employmentContracts: 'EmploymentContract',
    storedFiles: 'StoredFile',
    apiKeys: 'ApiKey',
    idempotencyRecords: 'IdempotencyRecord',
    warehouses: 'Warehouse',
    inventoryItems: 'InventoryItem',
    inventoryStocks: 'InventoryStock',
    inventoryTransactions: 'InventoryTransaction',
  },
  ApiKey: { company: 'Company' },
  IdempotencyRecord: { company: 'Company' },
  StoredFile: { employeeDocument: 'EmployeeDocument', employmentContract: 'EmploymentContract', company: 'Company' },
  Warehouse: { stock: 'InventoryStock', transactions: 'InventoryTransaction', workOrderParts: 'WorkOrderPart', company: 'Company' },
  InventoryItem: { supplier: 'Supplier', stock: 'InventoryStock', transactions: 'InventoryTransaction', workOrderParts: 'WorkOrderPart', company: 'Company' },
  InventoryStock: { item: 'InventoryItem', warehouse: 'Warehouse', company: 'Company' },
  InventoryTransaction: { item: 'InventoryItem', warehouse: 'Warehouse', workOrder: 'WorkOrder', company: 'Company' },
};

/**
 * Every model a query on `model` with `args` can read or write: the model
 * itself plus each related model named anywhere in the arguments (include,
 * select, _count, relation filters, relation sorts, nested writes), walked
 * recursively. Over-approximating is safe (an extra invalidation);
 * missing one would not be, so unknown shapes are walked, not skipped.
 */
export function modelsTouched(model: string, args: unknown, into: Set<string> = new Set()): Set<string> {
  into.add(model);
  const walk = (current: string, value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(current, item);
      return;
    }
    if (!value || typeof value !== 'object' || value instanceof Date) return;
    const relations = MODEL_RELATIONS[current] ?? {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const related = relations[key];
      if (related) {
        into.add(related);
        walk(related, child);
      } else {
        walk(current, child);
      }
    }
  };
  walk(model, args);
  return into;
}
