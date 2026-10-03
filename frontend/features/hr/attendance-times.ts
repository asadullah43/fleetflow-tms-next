import { combineDateTime } from '../../lib/date';
import type { FormValues } from '../crud/types';

/**
 * Time in / time out on the attendance form are times of day on the
 * attendance date (in the viewer's time zone). A time out earlier than
 * the time in is a night shift ending the next morning.
 */
export function attendanceTimes(date: string, timeIn: string, timeOut: string): { checkIn: string; checkOut: string } {
  const overnight = !!timeIn && !!timeOut && timeOut < timeIn;
  return { checkIn: combineDateTime(date, timeIn), checkOut: combineDateTime(date, timeOut, overnight ? 1 : 0) };
}

/** Hours between time in and time out ("8.5"), or '' when either is missing or they are the same. */
export function hoursBetween(timeIn: string, timeOut: string): string {
  const minutes = (time: string) => (/^\d{2}:\d{2}$/.test(time) ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN);
  const start = minutes(timeIn);
  const end = minutes(timeOut);
  if (Number.isNaN(start) || Number.isNaN(end) || start === end) return '';
  const worked = end > start ? end - start : end + 24 * 60 - start;
  return String(Math.round((worked / 60) * 100) / 100);
}

/**
 * Hours worked follows time in / out while it still shows the worked-out
 * value (or nothing); once someone types their own number it is left alone.
 */
export function deriveAttendance(next: FormValues, previous: FormValues, changed: string): FormValues {
  if (changed !== 'checkIn' && changed !== 'checkOut') return next;
  const before = hoursBetween(previous.checkIn ?? '', previous.checkOut ?? '');
  const typedByHand = (previous.hoursWorked ?? '') !== '' && previous.hoursWorked !== before;
  return typedByHand ? next : { ...next, hoursWorked: hoursBetween(next.checkIn ?? '', next.checkOut ?? '') };
}
