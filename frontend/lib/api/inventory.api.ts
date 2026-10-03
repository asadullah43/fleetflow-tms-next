import { fleetflow } from '../generated/proto/messages.js';
import { apiCall } from './client';
import { createCrudApi, listCall } from './crud-api';
import type { ListQuery, Page } from './types';

const inv = fleetflow.inventory;

export interface WarehouseDto {
  id: number;
  name: string;
  nameAr?: string;
  location?: string;
  status: string;
}
export const warehousesApi = createCrudApi<WarehouseDto>('warehouses', 'fleetflow.inventory.WarehousesService', inv, 'Warehouse');

export interface InventoryItemDto {
  id: number;
  name: string;
  nameAr?: string;
  itemNumber?: string;
  category?: string;
  minimumStock: number;
  unitCost: string;
  /** Sum over all warehouses. */
  totalQuantity: number;
  supplierId?: number;
  status: string;
  supplierName?: string;
  supplierNameAr?: string;
}
export const inventoryItemsApi = createCrudApi<InventoryItemDto>('inventoryItems', 'fleetflow.inventory.InventoryItemsService', inv, 'InventoryItem');

/** How many of one item one warehouse holds. */
export interface StockLevelDto {
  id: number;
  itemId: number;
  warehouseId: number;
  quantity: number;
  itemName?: string;
  itemNameAr?: string;
  itemNumber?: string;
  itemStatus?: string;
  minimumStock: number;
  /** The item's total across all warehouses. */
  totalQuantity: number;
  unitCost: string;
  warehouseName?: string;
  warehouseNameAr?: string;
  updatedAt?: string;
}
export const inventoryStockApi = {
  key: 'inventoryStock',
  list: (query?: ListQuery): Promise<Page<StockLevelDto>> => listCall<StockLevelDto>('fleetflow.inventory.InventoryStockService', 'List', inv.ListRequest, query),
};

export interface InventoryMovementDto {
  id: number;
  itemId: number;
  warehouseId: number;
  type: 'IN' | 'OUT';
  quantity: number;
  unitCost: string;
  remarks?: string;
  workOrderId?: number;
  /** When the stock moved (chosen by the user). */
  movementDate: string;
  /** When the entry was recorded. */
  createdAt: string;
  itemName?: string;
  itemNameAr?: string;
  itemNumber?: string;
  warehouseName?: string;
  warehouseNameAr?: string;
  workOrderNumber?: string;
}

/** A new item received for the first time (IN creates it). */
export interface NewInventoryItem {
  name: string;
  nameAr?: string;
  itemNumber?: string;
  category?: string;
  minimumStock?: number;
  unitCost?: string;
}

export interface StockIn {
  itemId?: number;
  newItem?: NewInventoryItem;
  warehouseId: number;
  quantity: number;
  remarks?: string;
  /** "YYYY-MM-DD"; omitted = today. */
  movementDate?: string;
}

export interface StockOut {
  itemId: number;
  warehouseId: number;
  quantity: number;
  remarks?: string;
  /** "YYYY-MM-DD"; omitted = today. */
  movementDate?: string;
}

const MOVES = 'fleetflow.inventory.InventoryTransactionsService';

/** The stock ledger. IN and OUT carry an idempotency key: a double submit moves stock once. */
export const inventoryMovementsApi = {
  key: 'inventoryMovements',
  list: (query?: ListQuery): Promise<Page<InventoryMovementDto>> => listCall<InventoryMovementDto>(MOVES, 'List', inv.ListRequest, query),
  stockIn: (values: StockIn, idempotencyKey: string) => apiCall<InventoryMovementDto>({ service: MOVES, method: 'StockIn', RequestType: inv.StockInRequest, request: { ...values }, idempotencyKey }),
  stockOut: (values: StockOut, idempotencyKey: string) => apiCall<InventoryMovementDto>({ service: MOVES, method: 'StockOut', RequestType: inv.StockOutRequest, request: { ...values }, idempotencyKey }),
};

/** Every query key a stock movement can change (stock, totals, the ledger, a work order's lines), for invalidation. */
export const STOCK_KEYS = [inventoryStockApi.key, inventoryItemsApi.key, inventoryMovementsApi.key, 'workOrderParts'];
