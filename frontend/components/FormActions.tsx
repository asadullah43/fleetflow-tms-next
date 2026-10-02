'use client';

import { Button, Group } from '@mantine/core';
import { useT } from '../lib/language-context';
import { tone } from '../theme/theme';

/** Cancel + submit at the foot of every modal form. `submitLabel` is untranslated. */
export function FormActions({ onCancel, saving, submitLabel = 'Save', disabled, onSubmit }: { onCancel: () => void; saving: boolean; submitLabel?: string; disabled?: boolean; onSubmit?: () => void }) {
  const t = useT();
  return (
    <Group justify="flex-end" gap="sm">
      <Button {...tone.secondary} onClick={onCancel} disabled={saving}>
        {t('Cancel')}
      </Button>
      <Button type={onSubmit ? 'button' : 'submit'} onClick={onSubmit} loading={saving} disabled={disabled}>
        {t(submitLabel)}
      </Button>
    </Group>
  );
}
