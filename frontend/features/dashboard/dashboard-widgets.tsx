'use client';

import { ReactNode } from 'react';
import { Alert, Box, Center, Group, Loader, Paper, Progress, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { Icon, IconName } from '../../components/icons';
import { useLocalizedDigits, useLocalizedStatValue, useT } from '../../lib/language-context';

export function StatCard({ icon, color, label, value }: { icon: IconName; color: string; label: string; value: string | number }) {
  const t = useT();
  const statValue = useLocalizedStatValue();
  const StatIcon = Icon[icon];
  return (
    <Paper p="md">
      <ThemeIcon variant="light" color={color} size={36} radius="md">
        <StatIcon size={18} />
      </ThemeIcon>
      <Text size="xs" c="dimmed" fw={500} mt="sm">
        {t(label)}
      </Text>
      <Text ff="monospace" fz={24} fw={600} lh={1.25} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {statValue(value)}
      </Text>
    </Paper>
  );
}

/** A labelled bar whose length is `value` relative to `max`. `label` is display text (already localized by the caller). */
export function BarRow({ text, value, max, color }: { text: string; value: number; max: number; color: string }) {
  const n = useLocalizedDigits();
  return (
    <Group gap="sm" wrap="nowrap">
      <Text size="sm" w={130} truncate>
        {text}
      </Text>
      <Progress value={max > 0 ? (value / max) * 100 : 0} color={color} size="md" radius="xl" style={{ flex: 1 }} aria-label={text} />
      <Text size="sm" ff="monospace" w={36} ta="end">
        {n(value)}
      </Text>
    </Group>
  );
}

export function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const t = useT();
  return (
    <Paper p="lg">
      <Title order={3} fz="md">
        {t(title)}
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        {t(subtitle)}
      </Text>
      <Stack gap="sm">{children}</Stack>
    </Paper>
  );
}

export function AttentionItem({ icon, color, children }: { icon: IconName; color: string; children: ReactNode }) {
  const ItemIcon = Icon[icon];
  return (
    <Group gap="sm" wrap="nowrap">
      <ThemeIcon variant="light" color={color} size={32} radius="md">
        <ItemIcon size={15} />
      </ThemeIcon>
      <Text size="sm">{children}</Text>
    </Group>
  );
}

export function Quiet({ children }: { children: ReactNode }) {
  return (
    <Text size="sm" c="dimmed">
      {children}
    </Text>
  );
}

/** Loading / failed / ready wrapper for one tab's summary. */
export function SummaryState<T>({ data, error, children }: { data: T | undefined; error: string | null; children: (data: T) => ReactNode }) {
  const t = useT();
  if (error) return <Alert color="red">{t(error)}</Alert>;
  if (!data) {
    return (
      <Paper>
        <Center py={64}>
          <Loader aria-label={t('Loading...')} />
        </Center>
      </Paper>
    );
  }
  return <Box>{children(data)}</Box>;
}
