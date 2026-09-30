type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const STATUS_TONE: Record<string, BadgeTone> = {
  ACTIVE: 'success',
  COMPLETED: 'success',
  PAID: 'success',
  DELIVERED: 'success',
  APPROVED: 'success',
  IN_PROGRESS: 'info',
  IN_TRANSIT: 'info',
  ASSIGNED: 'info',
  PENDING: 'warning',
  SCHEDULED: 'warning',
  MAINTENANCE: 'warning',
  INACTIVE: 'danger',
  CANCELLED: 'danger',
  OVERDUE: 'danger',
  REJECTED: 'danger',
  UNPAID: 'danger',
};

/** Renders a status string (e.g. Truck.status, Trip.status) as a colored badge. */
export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral';
  return <span className={`badge badge-${tone}`}>{formatStatus(status)}</span>;
}

function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
