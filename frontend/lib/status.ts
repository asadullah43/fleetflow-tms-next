/** Status codes used across the app -> badge colour. Unknown codes render grey. */
export const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'teal',
  COMPLETED: 'teal',
  PAID: 'teal',
  DELIVERED: 'teal',
  APPROVED: 'teal',
  PASS: 'teal',
  PRESENT: 'teal',
  SIGNED: 'teal',
  CLEARED: 'teal',
  REPORTED: 'teal',
  IN_PROGRESS: 'blue',
  IN_TRANSIT: 'blue',
  ASSIGNED: 'blue',
  OPEN: 'blue',
  PENDING: 'yellow',
  PENDING_SIGN: 'yellow',
  SCHEDULED: 'yellow',
  MAINTENANCE: 'yellow',
  ON_LEAVE: 'yellow',
  LATE: 'yellow',
  HALF_DAY: 'yellow',
  UPCOMING: 'yellow',
  INACTIVE: 'red',
  CANCELLED: 'red',
  OVERDUE: 'red',
  REJECTED: 'red',
  UNPAID: 'red',
  FAIL: 'red',
  FAILED: 'red',
  ABSENT: 'red',
  REVOKED: 'red',
  LOW_STOCK: 'red',
  IN_STOCK: 'teal',
  IN: 'teal',
  OUT: 'blue',
  TERMINATED: 'red',
  SUSPENDED: 'red',
};

/** "IN_PROGRESS" -> "In progress" (then passed through the dictionary for Arabic). */
export function statusLabel(status: string): string {
  const words = status.toLowerCase().split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Shade per hue for a filled badge: dark enough for white text, or (yellow) light enough for dark text. */
const FILLED_SHADE: Record<string, number> = { teal: 8, blue: 7, yellow: 5, red: 7, gray: 6 };

/** The filled colour for a status code, e.g. 'teal.8'. */
export function statusColor(status: string): string {
  const hue = STATUS_COLOR[status] ?? 'gray';
  return `${hue}.${FILLED_SHADE[hue] ?? 6}`;
}
