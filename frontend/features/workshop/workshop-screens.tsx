'use client';

import { CrudScreen } from '../crud/CrudScreen';
import { lookups } from '../crud/lookups';
import type { CrudDefinition } from '../crud/types';
import {
  maintenanceSchedulesApi,
  MaintenanceScheduleDto,
  sparePartsApi,
  SparePartDto,
  vehicleInspectionsApi,
  VehicleInspectionDto,
  workOrdersApi,
  WorkOrderDto,
  workshopExpensesApi,
  WorkshopExpenseDto,
} from '../../lib/api/workshop.api';
import { formatDate } from '../../lib/date';
import { localizedName } from '../../lib/localized-name';

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
    { name: 'partsCost', label: 'Parts cost', type: 'decimal', default: '0' },
    { name: 'otherCost', label: 'Other cost', type: 'decimal', default: '0' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ],
};
export const WorkOrdersScreen = () => <CrudScreen definition={workOrders} />;

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

// ── Inventory (spare parts) ─────────────────────────────────────────────
const PART_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISCONTINUED', label: 'Discontinued' },
];

const inventory: CrudDefinition<SparePartDto> = {
  api: sparePartsApi,
  title: 'Inventory',
  description: 'Spare parts stock levels, reorder thresholds, and unit cost.',
  addLabel: 'Spare Part',
  searchPlaceholder: 'Name, part # or category',
  emptyLabel: 'No spare parts in inventory yet.',
  columns: [
    { header: 'Name', value: (r, { language }) => localizedName(r, language), sortKey: 'name' },
    { header: 'Part #', value: (r) => r.partNumber, kind: 'mono', sortKey: 'partNumber' },
    { header: 'Qty', value: (r) => r.quantity, kind: 'mono', align: 'right', sortKey: 'quantity' },
    { header: 'Min stock', value: (r) => r.minimumStock, kind: 'mono', align: 'right' },
    { header: 'Unit cost', value: (r) => r.unitCost, kind: 'mono', align: 'right', sortKey: 'unitCost' },
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
  ],
  filters: [
    { name: 'status', label: 'Status', type: 'select', options: PART_STATUSES },
    { name: 'supplierId', label: 'Supplier', type: 'lookup', lookup: lookups.suppliers },
  ],
  fields: [
    { name: 'name', label: 'Name (English)', required: true },
    { name: 'nameAr', label: 'Name (Arabic)' },
    { name: 'partNumber', label: 'Part number' },
    { name: 'category', label: 'Category' },
    { name: 'quantity', label: 'Quantity in stock', type: 'integer', required: true, default: '0' },
    { name: 'minimumStock', label: 'Minimum stock level', type: 'integer', required: true, default: '0' },
    { name: 'unitCost', label: 'Unit cost', type: 'decimal', default: '0' },
    { name: 'supplierId', label: 'Supplier', type: 'lookup', lookup: lookups.suppliers },
    { name: 'status', label: 'Status', type: 'select', options: PART_STATUSES, default: 'ACTIVE', required: true },
  ],
};
export const InventoryScreen = () => <CrudScreen definition={inventory} />;
