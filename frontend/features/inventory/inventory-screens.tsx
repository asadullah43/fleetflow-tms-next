'use client';

import { CrudScreen } from '../crud/CrudScreen';
import { ACTIVE_INACTIVE, lookups } from '../crud/lookups';
import type { CrudDefinition } from '../crud/types';
import { InventoryItemDto, inventoryItemsApi, WarehouseDto, warehousesApi } from '../../lib/api/inventory.api';
import { localizedName } from '../../lib/localized-name';

// ── Warehouses ──────────────────────────────────────────────────────────
const warehouses: CrudDefinition<WarehouseDto> = {
  api: warehousesApi,
  title: 'Warehouses',
  description: 'Places stock is kept. Each item has its own quantity in every warehouse.',
  addLabel: 'Warehouse',
  searchPlaceholder: 'Name or location',
  emptyLabel: 'No warehouses yet — add one before receiving stock.',
  columns: [
    { header: 'Name', value: (r, { language }) => localizedName(r, language), sortKey: 'name' },
    { header: 'Location', value: (r) => r.location, sortKey: 'location' },
    { header: 'Status', value: (r) => r.status, kind: 'status', sortKey: 'status' },
  ],
  filters: [{ name: 'status', label: 'Status', type: 'select', options: ACTIVE_INACTIVE }],
  fields: [
    { name: 'name', label: 'Name (English)', required: true },
    { name: 'nameAr', label: 'Name (Arabic)' },
    { name: 'location', label: 'Location' },
    { name: 'status', label: 'Status', type: 'select', options: ACTIVE_INACTIVE, default: 'ACTIVE', required: true },
  ],
};
export const WarehousesScreen = () => <CrudScreen definition={warehouses} />;

// ── Items ───────────────────────────────────────────────────────────────
export const ITEM_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISCONTINUED', label: 'Discontinued' },
];

const items: CrudDefinition<InventoryItemDto> = {
  api: inventoryItemsApi,
  title: 'Inventory Items',
  description: 'What you stock, its reorder level and unit cost. Quantities change only through Stock in / Stock out.',
  addLabel: 'Item',
  searchPlaceholder: 'Name, item # or category',
  emptyLabel: 'No items yet — receive stock (Inventory → Stock in) or add an item here.',
  columns: [
    { header: 'Name', value: (r, { language }) => localizedName(r, language), sortKey: 'name' },
    { header: 'Item #', value: (r) => r.itemNumber, kind: 'mono', sortKey: 'itemNumber' },
    { header: 'Category', value: (r) => r.category, sortKey: 'category' },
    { header: 'In stock (all warehouses)', value: (r) => r.totalQuantity, kind: 'mono', align: 'right', sortKey: 'totalQuantity' },
    { header: 'Min stock', value: (r) => r.minimumStock, kind: 'mono', align: 'right', sortKey: 'minimumStock' },
    { header: 'Unit cost', value: (r) => r.unitCost, kind: 'mono', align: 'right', sortKey: 'unitCost' },
    { header: 'Status', value: (r) => (r.status === 'ACTIVE' && r.totalQuantity <= r.minimumStock ? 'LOW_STOCK' : r.status), kind: 'status', sortKey: 'status' },
  ],
  filters: [
    { name: 'status', label: 'Status', type: 'select', options: ITEM_STATUSES },
    { name: 'lowStock', label: 'Stock level', type: 'select', options: [{ value: 'LOW_STOCK', label: 'Low stock' }] },
    { name: 'supplierId', label: 'Supplier', type: 'lookup', lookup: lookups.suppliers },
  ],
  fields: [
    { name: 'name', label: 'Name (English)', required: true },
    { name: 'nameAr', label: 'Name (Arabic)' },
    { name: 'itemNumber', label: 'Item number / SKU' },
    { name: 'category', label: 'Category' },
    { name: 'minimumStock', label: 'Minimum stock level', type: 'integer', required: true, default: '0', hint: 'Low stock: the total across all warehouses is at or below this.' },
    { name: 'unitCost', label: 'Unit cost', type: 'decimal', default: '0' },
    { name: 'supplierId', label: 'Supplier', type: 'lookup', lookup: lookups.suppliers },
    { name: 'status', label: 'Status', type: 'select', options: ITEM_STATUSES, default: 'ACTIVE', required: true },
  ],
};
export const InventoryItemsScreen = () => <CrudScreen definition={items} />;
