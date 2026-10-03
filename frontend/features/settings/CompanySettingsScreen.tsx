'use client';

import { Alert, Box, Button, Center, FileButton, Group, Image, Loader, Paper, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { AppShell } from '../../components/AppShell';
import { PageHeader } from '../../components/PageHeader';
import { useT } from '../../lib/language-context';
import { tone } from '../../theme/theme';
import { SETTINGS_FIELDS, useCompanySettingsViewModel } from './use-company-settings-view-model';

function CompanySettingsBody() {
  const vm = useCompanySettingsViewModel();
  const t = useT();

  if (vm.loadError) return <Alert color="red">{t(vm.loadError)}</Alert>;
  if (vm.loading) {
    return (
      <Center py={80}>
        <Loader aria-label={t('Loading...')} />
      </Center>
    );
  }

  return (
    <>
      <PageHeader title="Company Settings" description="Your company's identity: shown in the app, in the browser tab, and on printed documents." />
      <Paper p="xl" maw={760}>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            vm.save();
          }}
        >
          <Stack gap="lg">
            {vm.saveError && <Alert color="red">{t(vm.saveError)}</Alert>}
            <Box>
              <Text size="sm" fw={500} mb={6}>
                {t('Company logo')}
              </Text>
              <Group gap="md" wrap="nowrap" align="center">
                <Center w={72} h={72} bg="white" style={{ borderRadius: 12, border: '1px solid var(--mantine-color-sand-3)', overflow: 'hidden', flexShrink: 0 }}>
                  {vm.logoUrl ? (
                    <Image src={vm.logoUrl} alt={t('Company logo')} w={72} h={72} fit="contain" />
                  ) : (
                    <Text size="xs" c="dimmed">
                      {t('No logo')}
                    </Text>
                  )}
                </Center>
                <Stack gap={6}>
                  <Group gap="xs">
                    <FileButton onChange={(file) => void vm.chooseLogo(file)} accept="image/*" disabled={!vm.canEdit}>
                      {(props) => (
                        <Button {...props} {...tone.secondary} size="xs">
                          {vm.logoUrl ? t('Replace logo') : t('Upload logo')}
                        </Button>
                      )}
                    </FileButton>
                    {vm.logoUrl && (
                      <Button {...tone.danger} size="xs" onClick={vm.removeLogo} disabled={!vm.canEdit}>
                        {t('Remove')}
                      </Button>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {t('PNG or JPG. Shown in the sidebar, sign-in screen, browser tab, and printed documents.')}
                  </Text>
                  {vm.logoError && (
                    <Text size="xs" c="red">
                      {t(vm.logoError)}
                    </Text>
                  )}
                </Stack>
              </Group>
            </Box>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {SETTINGS_FIELDS.map((field) => (
                <TextInput
                  key={field.name}
                  label={t(field.label)}
                  value={vm.valueOf(field.name)}
                  onChange={(event) => vm.setValue(field.name, event.currentTarget.value)}
                  readOnly={!vm.canEdit}
                  required={field.name === 'companyName'}
                  error={field.name === 'companyName' && vm.nameMissing ? t('This field is required.') : undefined}
                />
              ))}
            </SimpleGrid>

            {vm.canEdit && (
              <Group>
                <Button type="submit" loading={vm.saving} disabled={!vm.dirty || vm.nameMissing}>
                  {t('Save changes')}
                </Button>
              </Group>
            )}
          </Stack>
        </form>
      </Paper>
    </>
  );
}

export function CompanySettingsScreen() {
  return (
    <AppShell title="Company Settings">
      <CompanySettingsBody />
    </AppShell>
  );
}
