'use client';

import { Paper, Stack, Text, Title } from '@mantine/core';
import { AppShell } from '../../components/AppShell';
import { useT } from '../../lib/language-context';

/** What ZATCA e-invoicing support the app has today, stated plainly. No data is loaded here. */
export function ZatcaScreen() {
  const t = useT();
  return (
    <AppShell title="ZATCA e-Invoicing">
      <Paper p="xl" maw={680}>
        <Stack gap="sm">
          <Title order={2} fz="lg">
            {t('Phase-1 QR codes are live')}
          </Title>
          <Text size="sm" c="dimmed" lh={1.6}>
            {t('Every invoice gets a real ZATCA-compliant QR code (seller name, VAT number, timestamp, total, and VAT amount, TLV-encoded) when you use')}{' '}
            <Text span fw={700} c="dark">
              {t('Submit to ZATCA')}
            </Text>{' '}
            {t('on the Invoices page.')}
          </Text>
          <Text size="sm" c="dimmed" lh={1.6}>
            {t(
              "Phase-2 integration — the cryptographic invoice stamp and live clearance/reporting calls to ZATCA's API — needs a government-issued CSR and CSID certificate for your CR number, which this environment has no way to request or test against. The database is ready for it (see the company settings record's onboarding fields), so wiring in real certificates later is a config change, not a rebuild.",
            )}
          </Text>
        </Stack>
      </Paper>
    </AppShell>
  );
}
