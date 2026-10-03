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
/** A percentage from 0 to 100 as a string ("15", "12.5"); blank = not given. */
export const optionalPercentString = optionalDecimalString.refine((value) => value === undefined || value === '' || Number(value) <= 100, 'must be between 0 and 100');

/**
 * Adds "end on or after start" to a schema with two date strings. Only
 * checked when both are in the request; an update that sends one of them
 * is checked against the stored other one by the service.
 */
export function endOnOrAfterStart<T extends z.ZodTypeAny>(schema: T, start: string, end: string) {
  return schema.superRefine((value: Record<string, unknown>, ctx) => {
    const from = value[start];
    const to = value[end];
    if (typeof from === 'string' && typeof to === 'string' && from.trim() && to.trim() && new Date(to) < new Date(from)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [end], message: `must be on or after ${start}` });
    }
  });
}

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
