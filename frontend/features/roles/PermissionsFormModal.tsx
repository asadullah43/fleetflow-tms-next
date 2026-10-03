'use client';

import { Alert, Box, Modal, Stack, Text } from '@mantine/core';
import type { CSSProperties, ReactNode } from 'react';
import { FormActions } from '../../components/FormActions';
import type { PermissionDto } from '../../lib/api/roles.api';
import { useT } from '../../lib/language-context';
import { PermissionMatrix } from './PermissionMatrix';

/**
 * A flex column that may shrink below its content. Chained from the modal
 * body down to the permission matrix, it hands the matrix whatever height
 * the screen has left once the fields and buttons are laid out.
 */
const fillColumn: CSSProperties = { display: 'flex', flexDirection: 'column', flex: '0 1 auto', minHeight: 0 };

/**
 * The modal form for anything granted a permission matrix (roles, API
 * keys). Mantine caps a modal at the screen's height; here the fields,
 * the "Permissions" heading and Save/Cancel keep their size and only the
 * matrix scrolls, so every module row is reachable on a short screen and
 * nothing scrolls on a tall one.
 */
export function PermissionsFormModal({
  opened,
  onClose,
  title,
  onSubmit,
  error,
  fields,
  hint,
  permissions,
  onPermissionsChange,
  saving,
  submitLabel,
}: {
  opened: boolean;
  onClose: () => void;
  title: string;
  onSubmit: () => void;
  /** Untranslated form-level error, shown above the fields. */
  error: string | null;
  /** The inputs above the matrix; rendered only while the modal is open. */
  fields: ReactNode;
  /** Untranslated line under the "Permissions" heading. */
  hint?: string;
  permissions: PermissionDto[];
  onPermissionsChange: (next: PermissionDto[]) => void;
  saving: boolean;
  submitLabel?: string;
}) {
  const t = useT();
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size="lg"
      closeOnClickOutside={false}
      styles={{ content: { display: 'flex', flexDirection: 'column' }, body: fillColumn }}
    >
      {opened && (
        <form
          noValidate
          style={fillColumn}
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <Stack gap="md" style={fillColumn}>
            {error && <Alert color="red">{t(error)}</Alert>}
            {fields}
            <Box style={fillColumn}>
              <Text size="sm" fw={500} mb={hint ? 0 : 6}>
                {t('Permissions')}
              </Text>
              {hint && (
                <Text size="xs" c="dimmed" mb={6}>
                  {t(hint)}
                </Text>
              )}
              <PermissionMatrix value={permissions} onChange={onPermissionsChange} />
            </Box>
            <FormActions onCancel={onClose} saving={saving} submitLabel={submitLabel} />
          </Stack>
        </form>
      )}
    </Modal>
  );
}
