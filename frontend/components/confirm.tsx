'use client';

import { useCallback } from 'react';
import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useT } from '../lib/language-context';
import { tone } from '../theme/theme';

interface ConfirmOptions {
  /** Already-translated title (it usually names the record). */
  title: string;
  /** Untranslated body text. */
  message?: string;
  /** Untranslated confirm-button label. */
  confirmLabel?: string;
  onConfirm: () => void;
}

/** The confirmation every destructive action goes through: red confirm button, plain-language warning. */
export function useConfirmDanger() {
  const t = useT();
  return useCallback(
    ({ title, message = 'This cannot be undone.', confirmLabel = 'Delete', onConfirm }: ConfirmOptions) =>
      modals.openConfirmModal({
        title,
        children: <Text size="sm">{t(message)}</Text>,
        labels: { confirm: t(confirmLabel), cancel: t('Cancel') },
        confirmProps: { color: 'red.7' },
        cancelProps: tone.secondary,
        onConfirm,
      }),
    [t],
  );
}
