import { z } from 'zod';
import { dateString, decimalString, id, language, optionalDateString, optionalDecimalString, optionalId, optionalText, requiredText } from './common.validation.js';

export const createInspectionItemRequest = z.object({
  inspectionId: id,
  workOrderId: optionalId,
  checklistItem: requiredText,
  status: optionalText,
  defect: optionalText,
});

export const createMaintenanceScheduleRequest = z.object({
  truckId: id,
  maintenanceType: requiredText,
  description: optionalText,
  mileageInterval: optionalDecimalString,
  dayInterval: z.number().int().optional(),
  lastService: optionalDateString,
  nextService: optionalDateString,
  status: optionalText,
  notes: optionalText,
});

export const createVehicleInspectionRequest = z.object({
  truckId: id,
  inspectorId: id,
  inspectDate: dateString,
  odometer: optionalDecimalString,
  notes: optionalText,
  result: optionalText,
  attachments: optionalText,
});

/** Valued at the item's own unit cost (server-side), so no cost is sent. */
export const createWorkOrderPartRequest = z.object({
  workOrderId: id,
  itemId: id,
  warehouseId: id,
  quantity: z.number().int().positive().max(1_000_000),
});

/** One inventory line: an item, the warehouse it is taken from, how many. */
const workOrderPartLine = z.object({ itemId: id, warehouseId: id, quantity: z.number().int().positive().max(1_000_000) });

export const createWorkOrderRequest = z.object({
  truckId: id,
  driverId: optionalId,
  supplierId: optionalId,
  issue: requiredText,
  diagnosis: optionalText,
  description: optionalText,
  priority: optionalText,
  status: optionalText,
  startDate: optionalDateString,
  completionDate: optionalDateString,
  odometer: optionalDecimalString,
  laborCost: optionalDecimalString,
  partsCost: optionalDecimalString,
  otherCost: optionalDecimalString,
  notes: optionalText,
  /** Inventory used, taken from stock as the order is created (proto3: absent = []). */
  parts: z.array(workOrderPartLine).max(50).default([]),
});

export const createWorkshopExpenseRequest = z.object({
  truckId: id,
  workOrderId: optionalId,
  category: requiredText,
  amount: decimalString,
  description: optionalText,
  expenseDate: optionalDateString,
});

export const updateInspectionItemRequest = z.object({
  id: id,
  status: optionalText,
  defect: optionalText,
});

export const updateMaintenanceScheduleRequest = z.object({
  id: id,
  truckId: optionalId,
  maintenanceType: optionalText,
  description: optionalText,
  mileageInterval: optionalDecimalString,
  dayInterval: z.number().int().optional(),
  lastService: optionalDateString,
  nextService: optionalDateString,
  status: optionalText,
  notes: optionalText,
});

export const updateVehicleInspectionRequest = z.object({
  id: id,
  truckId: optionalId,
  inspectorId: optionalId,
  inspectDate: optionalDateString,
  odometer: optionalDecimalString,
  notes: optionalText,
  result: optionalText,
  attachments: optionalText,
});

export const updateWorkOrderRequest = z.object({
  id: id,
  truckId: optionalId,
  driverId: optionalId,
  supplierId: optionalId,
  issue: optionalText,
  diagnosis: optionalText,
  description: optionalText,
  priority: optionalText,
  status: optionalText,
  startDate: optionalDateString,
  completionDate: optionalDateString,
  odometer: optionalDecimalString,
  laborCost: optionalDecimalString,
  partsCost: optionalDecimalString,
  otherCost: optionalDecimalString,
  notes: optionalText,
});

export const updateWorkshopExpenseRequest = z.object({
  id: id,
  truckId: optionalId,
  workOrderId: optionalId,
  category: optionalText,
  amount: optionalDecimalString,
  description: optionalText,
  expenseDate: optionalDateString,
});
