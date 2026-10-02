'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Box, Group, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { useLocalizedDigits } from '../lib/language-context';
import { surface } from '../theme/theme';

export interface DonutSlice {
  key: string;
  /** Display label, already localized. */
  label: string;
  value: number;
  /** Fill colour (CSS). */
  color: string;
  /** Where clicking the slice (or its legend row) leads; omit for a slice that is not a link. */
  href?: string;
  onNavigate?: () => void;
  /** Tooltip line under the figures (e.g. what a click opens). */
  hint?: string;
}

const SIZE = 168;
const THICKNESS = 26;
const RADIUS = (SIZE - THICKNESS) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Surface gap between segments, in px along the ring. */
const GAP = 2;

/**
 * Part-to-whole at a glance (keep it to ≤ 6 segments; callers show their
 * own empty state when the total is 0). Every slice has a
 * hover tooltip with its count and share; the legend beside it repeats
 * label, count and share as text, so nothing depends on colour alone and
 * it doubles as the keyboard-reachable way to follow a slice's link.
 * Hovering a slice or its legend row highlights both.
 */
export function DonutChart({ slices, totalCaption, ariaLabel }: { slices: DonutSlice[]; totalCaption: string; ariaLabel: string }) {
  const n = useLocalizedDigits();
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const shown = slices.filter((slice) => slice.value > 0);
  const share = (value: number) => `${n(total > 0 ? Math.round((value / total) * 100) : 0)}%`;
  const focus = shown.find((slice) => slice.key === active);
  const follow = (slice: DonutSlice) => {
    if (!slice.href) return;
    slice.onNavigate?.();
    router.push(slice.href);
  };

  // Each arc starts where the ones before it end.
  const lengths = shown.map((slice) => (slice.value / total) * CIRCUMFERENCE);
  const arcs = shown.map((slice, index) => ({
    slice,
    dash: Math.max(lengths[index] - (shown.length > 1 ? GAP : 0), 0.5),
    offset: lengths.slice(0, index).reduce((sum, length) => sum + length, 0),
  }));

  return (
    <Group gap="xl" align="center" wrap="wrap" justify="center">
      <Box pos="relative" w={SIZE} h={SIZE} style={{ flexShrink: 0 }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={ariaLabel}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke={surface.border} strokeWidth={THICKNESS} opacity={0.5} />
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {arcs.map(({ slice, dash, offset }) => (
              <Tooltip.Floating
                key={slice.key}
                label={
                  <Stack gap={0}>
                    <Text size="xs" fw={600}>
                      {slice.label}
                    </Text>
                    <Text size="xs">
                      {n(slice.value)} · {share(slice.value)}
                    </Text>
                    {slice.hint && (
                      <Text size="xs" c="dimmed">
                        {slice.hint}
                      </Text>
                    )}
                  </Stack>
                }
                color="dark"
              >
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={active === slice.key ? THICKNESS + 6 : THICKNESS}
                  strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                  strokeDashoffset={-offset}
                  opacity={active && active !== slice.key ? 0.35 : 1}
                  style={{ cursor: slice.href ? 'pointer' : 'default', transition: 'opacity 120ms ease, stroke-width 120ms ease' }}
                  onMouseEnter={() => setActive(slice.key)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => follow(slice)}
                  aria-hidden
                />
              </Tooltip.Floating>
            ))}
          </g>
        </svg>
        <Stack gap={0} align="center" justify="center" pos="absolute" inset={0} style={{ pointerEvents: 'none' }}>
          <Text ff="monospace" fz={26} fw={600} lh={1.1} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {n(focus ? focus.value : total)}
          </Text>
          <Text size="xs" c="dimmed" ta="center" maw={SIZE - THICKNESS * 2 - 12} lineClamp={2}>
            {focus ? `${focus.label} · ${share(focus.value)}` : totalCaption}
          </Text>
        </Stack>
      </Box>

      <Stack gap={4} style={{ flex: 1, minWidth: 180 }} role="list" aria-label={ariaLabel}>
        {slices.map((slice) => {
          const row = (
            <Group gap="sm" wrap="nowrap" px={8} py={6} bg={active === slice.key ? 'sand.0' : undefined} style={{ borderRadius: 8 }}>
              <Box w={12} h={12} bg={slice.color} style={{ borderRadius: 3, flexShrink: 0 }} />
              <Text size="sm" style={{ flex: 1 }} truncate>
                {slice.label}
              </Text>
              <Text size="sm" ff="monospace" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {n(slice.value)}
              </Text>
              <Text size="xs" c="dimmed" ff="monospace" w={40} ta="end">
                {share(slice.value)}
              </Text>
            </Group>
          );
          const hover = { onMouseEnter: () => setActive(slice.key), onMouseLeave: () => setActive(null), onFocus: () => setActive(slice.key), onBlur: () => setActive(null) };
          return slice.href ? (
            <Tooltip key={slice.key} label={slice.hint} disabled={!slice.hint} withArrow openDelay={250}>
              <UnstyledButton component={Link} href={slice.href} onClick={slice.onNavigate} role="listitem" style={{ borderRadius: 8 }} {...hover}>
                {row}
              </UnstyledButton>
            </Tooltip>
          ) : (
            <Box key={slice.key} role="listitem" {...hover}>
              {row}
            </Box>
          );
        })}
      </Stack>
    </Group>
  );
}
