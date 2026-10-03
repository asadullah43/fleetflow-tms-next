'use client';

import { Badge } from '@mantine/core';
import { useT } from '../lib/language-context';
import { statusColor, statusLabel } from '../lib/status';

export { statusLabel };

/** Renders a status code (Truck.status, Invoice.status, ...) as a coloured, translated badge. */
export function StatusBadge({ status }: { status: string }) {
  const t = useT();
  if (!status) return null;
  return <Badge color={statusColor(status)}>{t(statusLabel(status))}</Badge>;
}
