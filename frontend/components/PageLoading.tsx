'use client';

import { AppShell } from './AppShell';
import { useT } from '../lib/language-context';

/** Placeholder page while a module page's lookups load — or the reason they couldn't. */
export function PageLoading({ title, error }: { title: string; error?: string | null }) {
  const t = useT();
  return (
    <AppShell title={title}>
      {error ? <div className="error-banner">{t(error)}</div> : <div className="empty-state">{t('Loading...')}</div>}
    </AppShell>
  );
}
