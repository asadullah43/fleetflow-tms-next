import { z } from 'zod';
import { id, language, optionalDateString, optionalDecimalString, optionalId, optionalText, requiredText } from './common.validation.js';

/** Units moved in one IN/OUT: a positive whole number. */
const quantity = z.number().int().positive().max(1_000_000);
const remarks = z.string().trim().max(500).optional();
/** The day the stock actually moved ("YYYY-MM-DD"); blank = today. Not the entry's own createdAt. */
const movementDate = optionalDateString;
const optionalCount = z.number().int().min(0).max(1_000_000).optional();

export const createWarehouseRequest = z.object({ name: requiredText, nameAr: optionalText, language: language.optional(), location: optionalText, status: optionalText });

export const updateWarehouseRequest = z.object({ id, name: optionalText, nameAr: optionalText, language: language.optional(), location: optionalText, status: optionalText });

// No quantity here: stock only changes through IN / OUT (and work orders), so it always has a ledger entry.
const itemFields = {
  nameAr: optionalText,
  language: language.optional(),
  itemNumber: optionalText,
  category: optionalText,
  minimumStock: optionalCount,
  unitCost: optionalDecimalString,
  supplierId: optionalId,
  status: optionalText,
};

export const createInventoryItemRequest = z.object({ name: requiredText, ...itemFields });
export const updateInventoryItemRequest = z.object({ id, name: optionalText, ...itemFields });

/** IN: an existing item (`itemId`) or a new one created in the same transaction (`newItem`) — exactly one. */
export const stockInRequest = z
  .object({ itemId: optionalId, newItem: createInventoryItemRequest.nullish().transform((value) => value ?? undefined), warehouseId: id, quantity, remarks, movementDate })
  .refine((input) => (input.itemId === undefined) !== (input.newItem === undefined), { message: 'give either itemId or newItem', path: ['itemId'] });

export const stockOutRequest = z.object({ itemId: id, warehouseId: id, quantity, remarks, movementDate });
