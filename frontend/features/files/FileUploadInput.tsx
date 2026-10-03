'use client';

import { useRef, useState } from 'react';
import { Button, FileButton, Group, Stack, Text } from '@mantine/core';
import { Icon } from '../../components/icons';
import { errorMessage } from '../../lib/api/errors';
import { FilePurpose, formatFileSize, UPLOAD_ACCEPT, uploadProblem } from '../../lib/api/files.api';
import { formatDateTime } from '../../lib/date';
import { useT } from '../../lib/language-context';
import { parseFileValue, withChosenFile } from './file-value';
import { useFileOpener, useFileUpload } from './use-files';

/**
 * A form's file: choose one (it is uploaded at once and attached when the
 * form is saved), open it, replace it or remove it. The value is the
 * string kept by file-value.ts.
 */
export function FileUploadInput({ purpose, value, onChange }: { purpose: FilePurpose; value: string; onChange: (value: string) => void }) {
  const t = useT();
  const upload = useFileUpload(purpose);
  const opener = useFileOpener();
  const resetRef = useRef<() => void>(null);
  const [error, setError] = useState<string | null>(null);
  const { file, original } = parseFileValue(value);
  const saved = !!file && file.id === original?.id;

  const pick = async (chosen: File | null) => {
    resetRef.current?.();
    if (!chosen) return;
    const problem = uploadProblem(chosen);
    if (problem) return setError(problem);
    setError(null);
    try {
      onChange(withChosenFile(value, await upload.mutateAsync(chosen)));
    } catch (failure) {
      setError(errorMessage(failure, 'Upload failed.'));
    }
  };

  const chooseButton = (label: string, variant: 'light' | 'default') => (
    <FileButton onChange={(chosen) => void pick(chosen)} accept={UPLOAD_ACCEPT} resetRef={resetRef}>
      {(props) => (
        <Button {...props} size="xs" variant={variant} leftSection={<Icon.upload size={14} />} loading={upload.isPending}>
          {t(label)}
        </Button>
      )}
    </FileButton>
  );

  return (
    <Stack gap={6} mt={4}>
      {file ? (
        <Group justify="space-between" wrap="nowrap" gap="sm" p="xs" style={{ border: '1px solid var(--mantine-color-sand-2)', borderRadius: 8 }}>
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <Icon.fileText size={20} />
            <Stack gap={0} style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} truncate="end" dir="auto">
                {file.name}
              </Text>
              <Text size="xs" c="dimmed">
                {formatFileSize(file.size)} · {file.contentType === 'application/pdf' ? 'PDF' : t('Image')}
                {saved && file.uploadedBy ? ` · ${t('Uploaded by')} ${file.uploadedBy}, ${formatDateTime(file.uploadedAt)}` : ` · ${t('attached when you save')}`}
              </Text>
            </Stack>
          </Group>
          <Group gap={6} wrap="nowrap">
            <Button size="xs" variant="default" leftSection={<Icon.eye size={14} />} onClick={() => opener.open(file.id)}>
              {t('View')}
            </Button>
            {chooseButton('Replace', 'default')}
            <Button size="xs" variant="subtle" color="red" onClick={() => onChange(withChosenFile(value, null))}>
              {t('Remove')}
            </Button>
          </Group>
        </Group>
      ) : (
        <Group gap="sm">
          {chooseButton('Choose file', 'light')}
          <Text size="xs" c="dimmed">
            {t('PDF or image (JPEG, PNG or WebP), up to 10 MB.')}
          </Text>
        </Group>
      )}
      {original && !file && (
        <Text size="xs" c="orange.8">
          {t('The attached file will be removed when you save.')}
        </Text>
      )}
      {error && (
        <Text size="xs" c="red">
          {t(error)}
        </Text>
      )}
    </Stack>
  );
}
