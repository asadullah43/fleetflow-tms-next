import { createCrudGrpcHandlers } from '../../lib/crud-grpc.js';
import { rpc } from '../../lib/grpc-handler.js';
import {
  workOrdersService,
  maintenanceSchedulesService,
  vehicleInspectionsService,
  sparePartsService,
  workshopExpensesService,
  workOrderPartsService,
  inspectionItemsService,
  sparePartTransactionsService,
} from './workshop.services.js';

// Every workshop table (including Inventory / spare parts) is guarded by the single `workshop` permission row.
const view = { module: 'workshop', action: 'view' } as const;
const add = { module: 'workshop', action: 'add' } as const;
const edit = { module: 'workshop', action: 'edit' } as const;
const del = { module: 'workshop', action: 'delete' } as const;

export const workOrdersGrpcImpl = createCrudGrpcHandlers(workOrdersService, { module: 'workshop' });
export const maintenanceSchedulesGrpcImpl = createCrudGrpcHandlers(maintenanceSchedulesService, { module: 'workshop' });
export const vehicleInspectionsGrpcImpl = createCrudGrpcHandlers(vehicleInspectionsService, { module: 'workshop' });
export const sparePartsGrpcImpl = createCrudGrpcHandlers(sparePartsService, { module: 'workshop' });
export const workshopExpensesGrpcImpl = createCrudGrpcHandlers(workshopExpensesService, { module: 'workshop' });

/** Line-item tables (no Get RPC — list/create/update/delete only, or a subset of those). */
export const workOrderPartsGrpcImpl = {
  list: rpc(view, async () => ({ items: await workOrderPartsService.findAll() }), 'read'),
  create: rpc(add, (req: any) => workOrderPartsService.create(req)),
  update: rpc(edit, ({ id, ...rest }: any) => workOrderPartsService.update(id, rest)),
  delete: rpc(del, async (req: { id: number }) => workOrderPartsService.remove(req.id), 'delete'),
};

export const inspectionItemsGrpcImpl = {
  list: rpc(view, async () => ({ items: await inspectionItemsService.findAll() }), 'read'),
  create: rpc(add, (req: any) => inspectionItemsService.create(req)),
  update: rpc(edit, ({ id, ...rest }: any) => inspectionItemsService.update(id, rest)),
  delete: rpc(del, async (req: { id: number }) => inspectionItemsService.remove(req.id), 'delete'),
};

export const sparePartTransactionsGrpcImpl = {
  list: rpc(view, async () => ({ items: await sparePartTransactionsService.findAll() }), 'read'),
  create: rpc(add, (req: any) => sparePartTransactionsService.create(req)),
  delete: rpc(del, async (req: { id: number }) => sparePartTransactionsService.remove(req.id), 'delete'),
};
