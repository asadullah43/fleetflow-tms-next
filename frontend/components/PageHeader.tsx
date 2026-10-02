'use client';

import { Box, Group, Text, Title } from '@mantine/core';
import { useT } from '../lib/language-context';

/** Title + one-line purpose of a page. */
export function PageHeader({ title, description }: { title: string; description?: string }) {
  const t = useT();
  return (
    <Group justify="space-between" align="flex-end" mb="md" wrap="wrap">
      <Box>
        <Title order={2} fz="xl">
          {t(title)}
        </Title>
        {description && (
          <Text c="dimmed" size="sm" mt={2} maw={640}>
            {t(description)}
          </Text>
        )}
      </Box>
    </Group>
  );
}
