'use client';

import { useState } from 'react';
import { actions } from '../../components/action-items';
import { CrudScreen } from '../crud/CrudScreen';
import { lookups } from '../crud/lookups';
import type { CrudDefinition } from '../crud/types';
import {
  maintenanceSchedulesApi,
  MaintenanceScheduleDto,
  vehicleInspectionsApi,
  VehicleInspectionDto,
  workOrdersApi,
  WorkOrderDto,
  workshopExpensesApi,
  WorkshopExpenseDto,
} from '../../lib/api/workshop.api';
import { formatDate } from '../../lib/date';
import { MOVEMENT_KEYS } from '../inventory/use-inventory-view-model';
import { NewWorkOrderParts, parseStagedParts } from './NewWorkOrderParts';
import { WorkOrderPartsModal } from './WorkOrderPartsModal';

const truckFilter = { name: 'truckId', label: 'Truck', type: 'lookup', lookup: lookups.trucks } as const;
const truckField = { name: 'truckId', label: 'Truck', type: 'lookup', lookup: lookups.trucks, required: true } as const;

// ── Work orders ─────────────────────────────────────────────────────────
const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];
const WORK_ORDER_STATUSES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const workOrders: CrudDefinition<WorkOrderDto> = {
  api: workOrdersApi,
  title: 'Work Orders',
  description: 'Track repair and service jobs per truck, from diagnosis to completion cost.',
  addLabel: 'Work Order',
  searchPlaceholder: 'Order #, truck or issue',
  emptyLabel: 'No work orders yet.',
  columns: [
    { header: 'Order #', value: (r) => r.orderNumber, kind: 'mono', sortKey: 'orderNumber' },
    { header: 'Truck', value: (r) => r.truckNumber, kind: 'mono' },
    { header: 'Issue', value: (r) => r.issue },
    { header: 'Priority', value: (r, { t }) => t(PRIORITIES.find((p) => p.value === r.priority)?.label ?? r.priority), sortKey: 'priority' },
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
    { header: 'Total cost', value: (r) => r.totalCost, kind: 'mono', align: 'right', sortKey: 'totalCost' },
  ],
  filters: [truckFilter, { name: 'status', label: 'Status', type: 'select', options: WORK_ORDER_STATUSES }, { name: 'priority', label: 'Priority', type: 'select', options: PRIORITIES }],
  fields: [
    truckField,
    { name: 'driverId', label: 'Driver', type: 'lookup', lookup: lookups.drivers },
    { name: 'supplierId', label: 'Workshop / supplier', type: 'lookup', lookup: lookups.suppliers },
    { name: 'issue', label: 'Issue', required: true },
    { name: 'diagnosis', label: 'Diagnosis', type: 'textarea' },
    { name: 'priority', label: 'Priority', type: 'select', options: PRIORITIES, default: 'MEDIUM', required: true },
    { name: 'status', label: 'Status', type: 'select', options: WORK_ORDER_STATUSES, default: 'OPEN', required: true },
    { name: 'laborCost', label: 'Labor cost', type: 'decimal', default: '0' },
    { name: 'partsCost', label: 'Parts cost', type: 'decimal', default: '0', hint: 'Inventory used on this work order is added here automatically, on top of any other parts you enter.' },
    { name: 'otherCost', label: 'Other cost', type: 'decimal', default: '0' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
    // On a new order: inventory taken from stock as it is saved. On an existing one: row menu → Inventory used.
    { name: 'parts', label: 'Inventory used', type: 'custom', createOnly: true, default: '[]', input: ({ value, onChange }) => <NewWorkOrderParts value={value} onChange={onChange} /> },
  ],
  toApi: (payload, values, mode) => (mode === 'create' ? { ...payload, parts: parseStagedParts(values.parts).map(({ itemId, warehouseId, quantity }) => ({ itemId, warehouseId, quantity })) } : payload),
  // Saving an order with inventory, or deleting one, changes stock and the ledger.
  invalidates: MOVEMENT_KEYS,
};
export function WorkOrdersScreen() {
  const [usedOn, setUsedOn] = useState<WorkOrderDto | null>(null);
  return (
    <>
      <CrudScreen definition={workOrders} rowActions={[(row) => actions.inventoryUsed(() => setUsedOn(row))]} />
      <WorkOrderPartsModal order={usedOn} onClose={() => setUsedOn(null)} />
    </>
  );
}

// ── Maintenance schedules ───────────────────────────────────────────────
const MAINTENANCE_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DONE', label: 'Done' },
  { value: 'OVERDUE', label: 'Overdue' },
];

const maintenance: CrudDefinition<MaintenanceScheduleDto> = {
  api: maintenanceSchedulesApi,
  title: 'Maintenance',
  description: 'Scheduled service per truck — last and next due dates.',
  addLabel: 'Maintenance Schedule',
  searchPlaceholder: 'Truck or maintenance type',
  emptyLabel: 'No maintenance schedules yet.',
  columns: [
    { header: 'Truck', value: (r) => r.truckNumber, kind: 'mono' },
    { header: 'Type', value: (r) => r.maintenanceType, sortKey: 'maintenanceType' },
    { header: 'Next service', value: (r) => formatDate(r.nextService), kind: 'mono', sortKey: 'nextService' },
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
  ],
  filters: [truckFilter, { name: 'status', label: 'Status', type: 'select', options: MAINTENANCE_STATUSES }],
  fields: [
    truckField,
    { name: 'maintenanceType', label: 'Maintenance type', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'lastService', label: 'Last service date', type: 'date' },
    { name: 'nextService', label: 'Next service date', type: 'date' },
    { name: 'status', label: 'Status', type: 'select', options: MAINTENANCE_STATUSES, default: 'ACTIVE', required: true },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
};
export const MaintenanceScreen = () => <CrudScreen definition={maintenance} />;

// ── Vehicle inspections ─────────────────────────────────────────────────
const RESULTS = [
  { value: 'PASS', label: 'Pass' },
  { value: 'FAIL', label: 'Fail' },
];

const inspections: CrudDefinition<VehicleInspectionDto> = {
  api: vehicleInspectionsApi,
  title: 'Inspections',
  description: 'Pass/fail vehicle inspection records per truck.',
  addLabel: 'Inspection',
  searchPlaceholder: 'Truck or inspector',
  emptyLabel: 'No inspections recorded yet.',
  columns: [
    { header: 'Truck', value: (r) => r.truckNumber, kind: 'mono' },
    { header: 'Inspector', value: (r) => r.inspectorName },
    { header: 'Date', value: (r) => formatDate(r.inspectDate), kind: 'mono', sortKey: 'inspectDate' },
    { header: 'Result', value: (r) => r.result, kind: 'status', sortKey: 'result' },
  ],
  filters: [truckFilter, { name: 'result', label: 'Result', type: 'select', options: RESULTS }, { name: 'fromDate', label: 'From Date', type: 'date' }, { name: 'toDate', label: 'To Date', type: 'date' }],
  fields: [
    truckField,
    { name: 'inspectorId', label: 'Inspector (user ID)', type: 'integer', required: true },
    { name: 'inspectDate', label: 'Inspection date', type: 'date', required: true },
    { name: 'result', label: 'Result', type: 'select', options: RESULTS, default: 'PASS', required: true },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
};
export const InspectionsScreen = () => <CrudScreen definition={inspections} />;

// ── Workshop expenses ───────────────────────────────────────────────────
const expenses: CrudDefinition<WorkshopExpenseDto> = {
  api: workshopExpensesApi,
  title: 'Expenses',
  description: 'Workshop spend per truck — parts, labor, and other repair costs.',
  addLabel: 'Expense',
  searchPlaceholder: 'Truck, category or description',
  emptyLabel: 'No workshop expenses recorded yet.',
  columns: [
    { header: 'Truck', value: (r) => r.truckNumber, kind: 'mono' },
    { header: 'Category', value: (r) => r.category, sortKey: 'category' },
    { header: 'Amount', value: (r) => r.amount, kind: 'mono', align: 'right', sortKey: 'amount' },
    { header: 'Date', value: (r) => formatDate(r.expenseDate), kind: 'mono', sortKey: 'expenseDate' },
  ],
  filters: [truckFilter, { name: 'fromDate', label: 'From Date', type: 'date' }, { name: 'toDate', label: 'To Date', type: 'date' }],
  fields: [
    truckField,
    { name: 'category', label: 'Category', required: true },
    { name: 'amount', label: 'Amount', type: 'decimal', required: true },
    { name: 'expenseDate', label: 'Expense date', type: 'date' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ],
};
export const WorkshopExpensesScreen = () => <CrudScreen definition={expenses} />;
