/**
 * Every route in the API, by service. app.ts registers exactly this — a
 * service or rpc that is not listed here does not exist to clients (and
 * test/routes.test.ts fails if the proto contract and this table drift).
 */
import type * as grpc from '@grpc/grpc-js';
import { grpcPackage } from '../_core_app_connectivities/grpc-proto.js';
import { apiKeysRoutes } from './api-keys.routes.js';
import { assignmentsRoutes } from './assignments.routes.js';
import { authRoutes } from './auth.routes.js';
import { cargoTypesRoutes } from './cargo-types.routes.js';
import { companySettingsRoutes } from './company-settings.routes.js';
import { customersRoutes } from './customers.routes.js';
import { dashboardRoutes } from './dashboard.routes.js';
import { driversRoutes } from './drivers.routes.js';
import { hrRoutes } from './hr.routes.js';
import { inventoryRoutes } from './inventory.routes.js';
import { invoicesRoutes } from './invoices.routes.js';
import { loadingOrdersRoutes } from './loading-orders.routes.js';
import { locationsRoutes } from './locations.routes.js';
import { rateContractsRoutes } from './rate-contracts.routes.js';
import { rolesRoutes } from './roles.routes.js';
import { supplierPaymentsRoutes } from './supplier-payments.routes.js';
import { suppliersRoutes } from './suppliers.routes.js';
import { tripsRoutes } from './trips.routes.js';
import { trucksRoutes } from './trucks.routes.js';
import { usersRoutes } from './users.routes.js';
import { workshopRoutes } from './workshop.routes.js';
import { buildService, ServiceRoutes } from './router.js';

export const allRoutes: ServiceRoutes = {
  ...apiKeysRoutes,
  ...assignmentsRoutes,
  ...authRoutes,
  ...cargoTypesRoutes,
  ...companySettingsRoutes,
  ...customersRoutes,
  ...dashboardRoutes,
  ...driversRoutes,
  ...hrRoutes,
  ...inventoryRoutes,
  ...invoicesRoutes,
  ...loadingOrdersRoutes,
  ...locationsRoutes,
  ...rateContractsRoutes,
  ...rolesRoutes,
  ...supplierPaymentsRoutes,
  ...suppliersRoutes,
  ...tripsRoutes,
  ...trucksRoutes,
  ...usersRoutes,
  ...workshopRoutes,
};

function serviceDefinition(serviceName: string): grpc.ServiceDefinition {
  const found = serviceName.split('.').reduce<any>((node, part) => node?.[part], grpcPackage);
  if (!found?.service) throw new Error(`No proto service named ${serviceName}`);
  return found.service;
}

export function registerRoutes(server: grpc.Server): void {
  for (const [serviceName, routes] of Object.entries(allRoutes)) {
    server.addService(serviceDefinition(serviceName), buildService(serviceName, routes));
  }
}
