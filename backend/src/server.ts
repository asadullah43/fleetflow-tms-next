import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { sanitizeService } from './lib/grpc-sanitize.js';

import { authGrpcImpl } from './modules/auth/auth.grpc.js';
import { locationsGrpcImpl } from './modules/locations/locations.grpc.js';
import { cargoTypesGrpcImpl } from './modules/cargo-types/cargo-types.grpc.js';
import { customersGrpcImpl } from './modules/customers/customers.grpc.js';
import { suppliersGrpcImpl } from './modules/suppliers/suppliers.grpc.js';
import { trucksGrpcImpl } from './modules/trucks/trucks.grpc.js';
import { driversGrpcImpl } from './modules/drivers/drivers.grpc.js';
import { assignmentsGrpcImpl } from './modules/assignments/assignments.grpc.js';
import { tripsGrpcImpl } from './modules/trips/trips.grpc.js';
import { rateContractsGrpcImpl } from './modules/rate-contracts/rate-contracts.grpc.js';
import { loadingOrdersGrpcImpl } from './modules/loading-orders/loading-orders.grpc.js';
import { supplierPaymentsGrpcImpl } from './modules/supplier-payments/supplier-payments.grpc.js';
import { companySettingsGrpcImpl } from './modules/company-settings/company-settings.grpc.js';
import { rolesGrpcImpl } from './modules/roles/roles.grpc.js';
import { usersGrpcImpl } from './modules/users/users.grpc.js';
import { invoicesGrpcImpl } from './modules/invoices/invoices.grpc.js';
import { dashboardGrpcImpl } from './modules/dashboard/dashboard.grpc.js';
import {
  departmentsGrpcImpl,
  designationsGrpcImpl,
  employeesGrpcImpl,
  attendanceGrpcImpl,
  leaveRequestsGrpcImpl,
  employeeDocumentsGrpcImpl,
  employmentContractsGrpcImpl,
} from './modules/hr/hr.grpc.js';
import {
  workOrdersGrpcImpl,
  maintenanceSchedulesGrpcImpl,
  vehicleInspectionsGrpcImpl,
  sparePartsGrpcImpl,
  workshopExpensesGrpcImpl,
  workOrderPartsGrpcImpl,
  inspectionItemsGrpcImpl,
  sparePartTransactionsGrpcImpl,
} from './modules/workshop/workshop.grpc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_DIR = path.resolve(__dirname, '../../proto');
const PORT = process.env.GRPC_PORT ?? '50051';

const packageDefinition = protoLoader.loadSync(
  [
    'auth.proto',
    'common.proto',
    'locations.proto',
    'cargo_types.proto',
    'customers.proto',
    'suppliers.proto',
    'trucks.proto',
    'drivers.proto',
    'assignments.proto',
    'trips.proto',
    'rate_contracts.proto',
    'loading_orders.proto',
    'supplier_payments.proto',
    'company_settings.proto',
    'roles.proto',
    'users.proto',
    'invoices.proto',
    'dashboard.proto',
    'hr.proto',
    'workshop.proto',
  ],
  {
    keepCase: false, // camelCase field names on the JS side (canView, roleId, ...)
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [PROTO_DIR],
  },
);

const proto = grpc.loadPackageDefinition(packageDefinition) as any;

const server = new grpc.Server();

server.addService(proto.fleetflow.auth.AuthService.service, sanitizeService(authGrpcImpl));
server.addService(proto.fleetflow.locations.LocationsService.service, sanitizeService(locationsGrpcImpl));
server.addService(proto.fleetflow.cargotypes.CargoTypesService.service, sanitizeService(cargoTypesGrpcImpl));
server.addService(proto.fleetflow.customers.CustomersService.service, sanitizeService(customersGrpcImpl));
server.addService(proto.fleetflow.suppliers.SuppliersService.service, sanitizeService(suppliersGrpcImpl));
server.addService(proto.fleetflow.trucks.TrucksService.service, sanitizeService(trucksGrpcImpl));
server.addService(proto.fleetflow.drivers.DriversService.service, sanitizeService(driversGrpcImpl));
server.addService(proto.fleetflow.assignments.AssignmentsService.service, sanitizeService(assignmentsGrpcImpl));
server.addService(proto.fleetflow.trips.TripsService.service, sanitizeService(tripsGrpcImpl));
server.addService(proto.fleetflow.ratecontracts.RateContractsService.service, sanitizeService(rateContractsGrpcImpl));
server.addService(proto.fleetflow.loadingorders.LoadingOrdersService.service, sanitizeService(loadingOrdersGrpcImpl));
server.addService(proto.fleetflow.supplierpayments.SupplierPaymentsService.service, sanitizeService(supplierPaymentsGrpcImpl));
server.addService(proto.fleetflow.companysettings.CompanySettingsService.service, sanitizeService(companySettingsGrpcImpl));
server.addService(proto.fleetflow.roles.RolesService.service, sanitizeService(rolesGrpcImpl));
server.addService(proto.fleetflow.users.UsersService.service, sanitizeService(usersGrpcImpl));
server.addService(proto.fleetflow.invoices.InvoicesService.service, sanitizeService(invoicesGrpcImpl));
server.addService(proto.fleetflow.dashboard.DashboardService.service, sanitizeService(dashboardGrpcImpl));

server.addService(proto.fleetflow.hr.DepartmentsService.service, sanitizeService(departmentsGrpcImpl));
server.addService(proto.fleetflow.hr.DesignationsService.service, sanitizeService(designationsGrpcImpl));
server.addService(proto.fleetflow.hr.EmployeesService.service, sanitizeService(employeesGrpcImpl));
server.addService(proto.fleetflow.hr.AttendanceService.service, sanitizeService(attendanceGrpcImpl));
server.addService(proto.fleetflow.hr.LeaveRequestsService.service, sanitizeService(leaveRequestsGrpcImpl));
server.addService(proto.fleetflow.hr.EmployeeDocumentsService.service, sanitizeService(employeeDocumentsGrpcImpl));
server.addService(proto.fleetflow.hr.EmploymentContractsService.service, sanitizeService(employmentContractsGrpcImpl));

server.addService(proto.fleetflow.workshop.WorkOrdersService.service, sanitizeService(workOrdersGrpcImpl));
server.addService(proto.fleetflow.workshop.MaintenanceSchedulesService.service, sanitizeService(maintenanceSchedulesGrpcImpl));
server.addService(proto.fleetflow.workshop.VehicleInspectionsService.service, sanitizeService(vehicleInspectionsGrpcImpl));
server.addService(proto.fleetflow.workshop.SparePartsService.service, sanitizeService(sparePartsGrpcImpl));
server.addService(proto.fleetflow.workshop.WorkshopExpensesService.service, sanitizeService(workshopExpensesGrpcImpl));
server.addService(proto.fleetflow.workshop.WorkOrderPartsService.service, sanitizeService(workOrderPartsGrpcImpl));
server.addService(proto.fleetflow.workshop.InspectionItemsService.service, sanitizeService(inspectionItemsGrpcImpl));
server.addService(proto.fleetflow.workshop.SparePartTransactionsService.service, sanitizeService(sparePartTransactionsGrpcImpl));

server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
  if (err) {
    console.error('Failed to start gRPC server:', err);
    process.exit(1);
  }
  console.log(`FleetFlow gRPC server listening on 0.0.0.0:${boundPort}`);
});
