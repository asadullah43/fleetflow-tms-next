'use client';

import { FormEvent, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { errorMessage } from '../../lib/api/errors';
import { useLanguage } from '../../lib/language-context';
import { firstAllowedHref } from '../../lib/nav-config';
import { hasPermission, moduleForPath } from '../../lib/permissions';
import { useAuth } from './session-provider';

/** State and actions of the sign-in screen. */
export function useLoginViewModel() {
  const { login, sessionNotice } = useAuth();
  const { language } = useLanguage();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const signIn = useMutation({
    mutationFn: () => login(username.trim(), password, language),
    onSuccess: (permissions) => {
      // Land on the dashboard when the role can see it, otherwise on the first page it can.
      router.push(
        firstAllowedHref((href) => {
          const pageModule = moduleForPath(href);
          return !pageModule || hasPermission(permissions, pageModule, 'view');
        }),
      );
    },
  });

  const { mutate, isPending } = signIn;
  const submit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (!isPending && username.trim() && password) mutate();
    },
    [isPending, username, password, mutate],
  );

  return {
    username,
    setUsername,
    password,
    setPassword,
    submit,
    submitting: isPending,
    /** A failed attempt takes precedence over the reason the previous session ended. */
    error: signIn.isError ? errorMessage(signIn.error, 'Login failed. Please try again.') : null,
    notice: signIn.isError ? null : sessionNotice,
  };
}
