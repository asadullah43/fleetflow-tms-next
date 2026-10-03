/**
 * Building blocks shared by every module's request schemas. proto3 sends
 * "" / 0 for unset non-optional scalars, so "required" here means
 * non-empty / positive, not merely present.
 */
import { z } from 'zod';
import { config } from '../global_config/index.js';

export const id = z.number().int().positive();
export const optionalId = z.number().int().positive().optional();
/** An attached file on update: a file id to attach (replacing the current one), 0 to remove it, absent to keep it. */
export const fileReference = z.number().int().nonnegative().optional();
/** An optional reference that may be cleared by sending 0. */
export const requiredText = z.string().trim().min(1);
export const optionalText = z.string().optional();
/** "YYYY-MM-DD" or a full ISO timestamp. */
export const dateString = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'must be a valid date');
export const optionalDateString = z
  .string()
  .trim()
  .refine((value) => value === '' || !Number.isNaN(new Date(value).getTime()), 'must be a valid date')
  .optional();
/** Non-negative decimal as a string ("150", "99.95"). */
export const decimalString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, 'must be a non-negative number');
export const optionalDecimalString = z
  .string()
  .trim()
  .regex(/^(\d+(\.\d+)?)?$/, 'must be a non-negative number')
  .optional();
export const language = z.enum(['en', 'ar']);

export const idRequest = z.object({ id });
export const emptyRequest = z.object({});

export const listRequest = z.object({
  page: z
    .number()
    .int()
    .min(0)
    .transform((value) => value || 1),
  pageSize: z
    .number()
    .int()
    .min(0)
    .max(config.pagination.maxPageSize)
    .transform((value) => value || config.pagination.defaultPageSize),
  search: z.string().max(200).default(''),
  sortBy: z.string().max(50).default(''),
  sortOrder: z
    .string()
    .transform((value) => (value.toLowerCase() === 'asc' ? ('asc' as const) : ('desc' as const)))
    .default('desc'),
  filters: z.record(z.string().max(200)).default({}),
});
