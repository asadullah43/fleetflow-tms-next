'use client';

import { ReactNode, useState } from 'react';
import { DirectionProvider, MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from '../features/auth/session-provider';
import { BrandingEffects } from '../features/branding/BrandingEffects';
import { isApiError } from '../lib/api/errors';
import { LanguageProvider, useLanguage } from '../lib/language-context';
import { theme } from '../theme/theme';

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Only a network failure is worth retrying; an answer from the backend (denied, invalid, rate limited) is final.
        retry: (failures, error) => isApiError(error) && error.transport && failures < 2,
      },
      mutations: { retry: false },
    },
  });
}

/** Mantine's date pickers follow the app language (Day.js locale). */
function LocalizedDates({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  return <DatesProvider settings={{ locale: language, firstDayOfWeek: 0, weekendDays: [5, 6] }}>{children}</DatesProvider>;
}

/** Every app-wide provider, in dependency order. Mounted once in the root layout. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <DirectionProvider detectDirection={false}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <LanguageProvider>
              <LocalizedDates>
                <ModalsProvider>
                  <Notifications position="top-right" />
                  <BrandingEffects />
                  {children}
                </ModalsProvider>
              </LocalizedDates>
            </LanguageProvider>
          </SessionProvider>
        </QueryClientProvider>
      </MantineProvider>
    </DirectionProvider>
  );
}
