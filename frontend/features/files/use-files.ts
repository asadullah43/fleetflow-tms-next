'use client';

import { useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { errorMessage } from '../../lib/api/errors';
import { FilePurpose, filesApi } from '../../lib/api/files.api';
import { useT } from '../../lib/language-context';

/** Uploading one file for a form (it is attached to the record when the form is saved). */
export function useFileUpload(purpose: FilePurpose) {
  return useMutation({ mutationFn: (file: File) => filesApi.upload(purpose, file) });
}

/** Open (new tab) and download for an attached file, with the app's error notice when that fails. */
export function useFileOpener() {
  const t = useT();
  const run = useCallback(
    async (action: () => Promise<void>) => {
      try {
        await action();
      } catch (error) {
        notifications.show({ color: 'red', title: t('Could not open the file.'), message: t(errorMessage(error)) });
      }
    },
    [t],
  );
  return { open: useCallback((id: number) => void run(() => filesApi.open(id)), [run]), download: useCallback((id: number) => void run(() => filesApi.download(id)), [run]) };
}
