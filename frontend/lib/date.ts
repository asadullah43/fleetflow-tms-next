import dayjs from 'dayjs';
import 'dayjs/locale/ar';

/** All date handling goes through Day.js, in one place. The API speaks ISO strings; forms and filters use YYYY-MM-DD. */
export const DATE_FORMAT = 'YYYY-MM-DD';

export function today(): string {
  return dayjs().format(DATE_FORMAT);
}

/** The first day of the current month (YYYY-MM-DD) — the start of every "this month" figure. */
export function monthStart(): string {
  return dayjs().startOf('month').format(DATE_FORMAT);
}

/** An API timestamp or date -> the calendar date it was entered as (YYYY-MM-DD), or '' when absent/invalid. */
export function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  // Dates are stored at UTC midnight; reading the leading date part avoids shifting a day in other time zones.
  const leading = /^\d{4}-\d{2}-\d{2}/.exec(value)?.[0];
  if (leading) return leading;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format(DATE_FORMAT) : '';
}

export function formatDate(value: string | null | undefined, fallback = '—'): string {
  return toDateInput(value) || fallback;
}

/** A date with its time, in the viewer's time zone (audit-style fields: "last used", "generated on"). */
export function formatDateTime(value: string | null | undefined, fallback = '—'): string {
  if (!value) return fallback;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : fallback;
}

/** An API timestamp -> the time of day in the viewer's time zone (HH:mm), or '' when absent/invalid. */
export function toTimeInput(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('HH:mm') : '';
}

/** A calendar date (YYYY-MM-DD) and a time of day (HH:mm) in the viewer's time zone -> the API timestamp, or '' when either is missing. */
export function combineDateTime(date: string, time: string, addDays = 0): string {
  if (!date || !time) return '';
  const parsed = dayjs(`${date}T${time}`);
  return parsed.isValid() ? parsed.add(addDays, 'day').toISOString() : '';
}

/** For printed documents: 05-Oct-2026. */
export function formatDocumentDate(value: string): string {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.locale('en').format('DD-MMM-YYYY') : '';
}

export function msUntil(value: string): number {
  return dayjs(value).diff(dayjs());
}

export type AssignmentPeriodState = 'active' | 'upcoming' | 'completed';

/** Where today falls relative to a start/end date range (end omitted = ongoing). */
export function periodState(startDate: string, endDate?: string | null): AssignmentPeriodState {
  const now = today();
  if (toDateInput(startDate) > now) return 'upcoming';
  const end = toDateInput(endDate);
  if (end && end < now) return 'completed';
  return 'active';
}
