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

export const createSparePartRequest = z.object({
  name: requiredText,
  language: language.optional(),
  partNumber: optionalText,
  category: optionalText,
  quantity: z.number().int().optional(),
  minimumStock: z.number().int().optional(),
  unitCost: optionalDecimalString,
  supplierId: optionalId,
  status: optionalText,
  nameAr: optionalText,
});

export const createSparePartTransactionRequest = z.object({
  sparePartId: id,
  transactionType: requiredText,
  quantity: z.number().int(),
  referenceNote: optionalText,
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

export const createWorkOrderPartRequest = z.object({
  workOrderId: id,
  sparePartId: id,
  quantity: z.number().int(),
  unitCost: decimalString,
});

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

export const updateSparePartRequest = z.object({
  id: id,
  name: optionalText,
  language: language.optional(),
  partNumber: optionalText,
  category: optionalText,
  quantity: z.number().int().optional(),
  minimumStock: z.number().int().optional(),
  unitCost: optionalDecimalString,
  supplierId: optionalId,
  status: optionalText,
  nameAr: optionalText,
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

export const updateWorkOrderPartRequest = z.object({
  id: id,
  quantity: z.number().int().optional(),
  unitCost: optionalDecimalString,
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
