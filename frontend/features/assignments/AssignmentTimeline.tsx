'use client';

import { ReactNode } from 'react';
import { Box, Group, Stack, Text } from '@mantine/core';
import { StatusBadge } from '../../components/StatusBadge';
import type { AssignmentDto } from '../../lib/api/assignments.api';
import { formatDate } from '../../lib/date';
import { useLanguage, useT } from '../../lib/language-context';
import { localizedJoinedName } from '../../lib/localized-name';
import { STATUS_COLOR } from '../../lib/status';
import { assignmentState, STATE_STATUS } from './assignment-state';

/** Dot-and-line timeline of a truck's assignments. `actions` adds a per-entry action menu where the screen allows edits. */
export function AssignmentTimeline({ history, actions }: { history: AssignmentDto[]; actions?: (assignment: AssignmentDto) => ReactNode }) {
  const t = useT();
  const { language } = useLanguage();
  if (history.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('No assignment history yet.')}
      </Text>
    );
  }

  return (
    <Stack gap={0}>
      {history.map((assignment, index) => {
        const state = assignmentState(assignment);
        const hue = STATUS_COLOR[STATE_STATUS[state]] ?? 'gray';
        const color = `var(--mantine-color-${hue}-6)`;
        return (
          <Group key={assignment.id} gap="md" align="stretch" wrap="nowrap">
            <Stack gap={2} align="center" w={16} style={{ flexShrink: 0 }}>
              <Box w={12} h={12} mt={6} bg={color} style={{ borderRadius: '50%', boxShadow: `0 0 0 3px var(--mantine-color-${hue}-1)`, flexShrink: 0 }} />
              {index < history.length - 1 && <Box w={2} bg="sand.2" style={{ flex: 1 }} />}
            </Stack>
            <Box pb="lg" style={{ flex: 1 }}>
              <Group justify="space-between" gap="sm" wrap="nowrap">
                <Text fw={600} size="sm">
                  {localizedJoinedName(assignment.driverName, assignment.driverNameAr, language) ?? `#${assignment.driverId}`}
                </Text>
                <Group gap="xs" wrap="nowrap">
                  <StatusBadge status={STATE_STATUS[state]} />
                  {actions?.(assignment)}
                </Group>
              </Group>
              <Text size="xs" c="dimmed" ff="monospace" mt={2} dir="ltr" ta="start">
                {formatDate(assignment.startDate)} → {assignment.endDate ? formatDate(assignment.endDate) : t('Ongoing')}
              </Text>
            </Box>
          </Group>
        );
      })}
    </Stack>
  );
}
