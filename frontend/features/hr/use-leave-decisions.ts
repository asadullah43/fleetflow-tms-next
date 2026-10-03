'use client';

import { useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { errorMessage } from '../../lib/api/errors';
import { leaveRequestsApi, LeaveRequestDto } from '../../lib/api/hr.api';
import { useT } from '../../lib/language-context';
import { useResourceMutations } from '../crud/crud.queries';

/** Approving / rejecting a leave request from its row (the backend requires "edit" on Leave requests for it). */
export function useLeaveDecisions() {
  const t = useT();
  const { update } = useResourceMutations(leaveRequestsApi);
  const decide = useCallback(
    async (row: LeaveRequestDto, status: 'APPROVED' | 'REJECTED') => {
      try {
        await update.mutateAsync({ id: row.id, values: { status } });
        notifications.show({ color: 'teal', message: t(status === 'APPROVED' ? 'Leave request approved.' : 'Leave request rejected.') });
      } catch (error) {
        notifications.show({ color: 'red', title: t('Save failed.'), message: t(errorMessage(error, 'Save failed.')) });
      }
    },
    [update, t],
  );
  return { decide, decidingId: update.isPending ? update.variables?.id : null };
}
