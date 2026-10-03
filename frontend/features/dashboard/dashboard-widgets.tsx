'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Alert, Box, Center, Group, Loader, Paper, Progress, Stack, Text, ThemeIcon, Title, Tooltip, UnstyledButton, useDirection } from '@mantine/core';
import { useHover } from '@mantine/hooks';
import { Icon, IconName } from '../../components/icons';
import { useLocalizedDigits, useLocalizedStatValue, useT } from '../../lib/language-context';
import { DrillDown, ResolvedDrillDown, useDrillDown } from './drill-down';

/** "→", mirrored in RTL so it always points towards where the text reads to. */
function GoArrow({ visible }: { visible: boolean }) {
  const { dir } = useDirection();
  return (
    <Box c="brand.7" display="flex" style={{ opacity: visible ? 1 : 0, transform: `${dir === 'rtl' ? 'scaleX(-1) ' : ''}translateX(${visible ? 0 : -4}px)`, transition: 'opacity 140ms ease, transform 140ms ease' }}>
      <Icon.arrowEnd size={16} />
    </Box>
  );
}

/**
 * Makes `children` a link to a drill-down when there is one: pointer
 * cursor, a tooltip saying what opens, the platform focus ring. `render`
 * receives the hover state so the card can react to it.
 */
function DrillLink({ drill, label, render }: { drill: ResolvedDrillDown | null; label: string; render: (hovered: boolean) => ReactNode }) {
  const { hovered, ref } = useHover<HTMLAnchorElement>();
  if (!drill) return <>{render(false)}</>;
  return (
    <Tooltip label={drill.hint} withArrow openDelay={300}>
      <UnstyledButton ref={ref} component={Link} href={drill.href} onClick={drill.onNavigate} display="block" h="100%" aria-label={`${label} — ${drill.hint}`} style={{ borderRadius: 'var(--mantine-radius-lg)' }}>
        {render(hovered)}
      </UnstyledButton>
    </Tooltip>
  );
}

export function StatCard({ icon, color, label, value, to }: { icon: IconName; color: string; label: string; value: string | number; to?: DrillDown }) {
  const t = useT();
  const statValue = useLocalizedStatValue();
  const drill = useDrillDown()(to);
  const StatIcon = Icon[icon];
  return (
    <DrillLink
      drill={drill}
      label={`${t(label)}: ${statValue(value)}`}
      render={(hovered) => (
        <Paper
          p="md"
          h="100%"
          style={{
            borderColor: hovered ? 'var(--mantine-color-brand-3)' : undefined,
            boxShadow: hovered ? 'var(--mantine-shadow-md)' : undefined,
            transform: hovered ? 'translateY(-2px)' : undefined,
            transition: 'border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease',
          }}
        >
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <ThemeIcon color={color} size={36} radius="md">
              <StatIcon size={18} />
            </ThemeIcon>
            {drill && <GoArrow visible={hovered} />}
          </Group>
          <Text size="xs" c="dimmed" fw={500} mt="sm">
            {t(label)}
          </Text>
          <Text ff="monospace" fz={24} fw={600} lh={1.25} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {statValue(value)}
          </Text>
        </Paper>
      )}
    />
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

export function AttentionItem({ icon, color, to, children }: { icon: IconName; color: string; to?: DrillDown; children: ReactNode }) {
  const drill = useDrillDown()(to);
  const ItemIcon = Icon[icon];
  return (
    <DrillLink
      drill={drill}
      label={drill?.hint ?? ''}
      render={(hovered) => (
        <Group gap="sm" wrap="nowrap" p={6} m={-6} bg={hovered ? 'sand.0' : undefined} style={{ borderRadius: 10, transition: 'background-color 120ms ease' }}>
          <ThemeIcon color={color} size={32} radius="md">
            <ItemIcon size={15} />
          </ThemeIcon>
          <Text size="sm" style={{ flex: 1 }}>
            {children}
          </Text>
          {drill && <GoArrow visible={hovered} />}
        </Group>
      )}
    />
  );
}

/** One ratio against its whole (a meter, not a 2-slice pie): share of the fleet that is active. */
export function FleetAvailability({ active, fleetSize }: { active: number; fleetSize: number }) {
  const t = useT();
  const n = useLocalizedDigits();
  const drill = useDrillDown()({ href: '/trucks', filters: { status: 'ACTIVE' } });
  const share = fleetSize > 0 ? Math.round((active / fleetSize) * 100) : 0;
  const idle = Math.max(fleetSize - active, 0);
  return (
    <DrillLink
      drill={drill}
      label={`${t('Fleet availability')}: ${n(share)}%`}
      render={(hovered) => (
        <Stack gap="xs" p={6} m={-6} bg={hovered ? 'sand.0' : undefined} style={{ borderRadius: 10, transition: 'background-color 120ms ease' }}>
          <Group justify="space-between" align="flex-end" wrap="nowrap">
            <Text ff="monospace" fz={32} fw={600} lh={1} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {n(share)}%
            </Text>
            {drill && <GoArrow visible={hovered} />}
          </Group>
          <Tooltip.Floating label={`${n(active)} ${t('active')} · ${n(idle)} ${t('not in service')}`}>
            <Progress value={share} color="teal.8" size="lg" radius="xl" aria-label={t('Fleet availability')} />
          </Tooltip.Floating>
          <Text size="sm" c="dimmed">
            {n(active)} {t('of')} {n(fleetSize)} {t('trucks are active; the rest are in maintenance or inactive.')}
          </Text>
        </Stack>
      )}
    />
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
