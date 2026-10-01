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
  TERMINATED: 'red',
  SUSPENDED: 'red',
};

/** "IN_PROGRESS" -> "In progress" (then passed through the dictionary for Arabic). */
export function statusLabel(status: string): string {
  const words = status.toLowerCase().split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
