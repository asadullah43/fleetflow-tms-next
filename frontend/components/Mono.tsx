import { ReactNode } from 'react';
import { Text } from '@mantine/core';

/** Codes, amounts, dates and counts: monospaced, tabular digits, never wrapped. */
export function Mono({ children, fw }: { children: ReactNode; fw?: number }) {
  return (
    <Text span ff="monospace" fz="sm" fw={fw} style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      {children}
    </Text>
  );
}
