'use client';

import { Alert, Box, Button, Center, Flex, Group, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { BrandMark } from '../../components/BrandMark';
import { Icon } from '../../components/icons';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { useT } from '../../lib/language-context';
import { rail, surface } from '../../theme/theme';
import { useBranding } from '../branding/use-branding';
import { useLoginViewModel } from './use-login-view-model';

const HERO_ICONS = ['truck', 'building', 'box', 'mapPin'] as const;

/** Sign-in: a dark brand panel beside the form on wide screens, the form alone on narrow ones. */
export function LoginScreen() {
  const vm = useLoginViewModel();
  const { companyName, logoUrl } = useBranding();
  const t = useT();

  return (
    <Flex mih="100vh" bg={surface.page}>
      <Flex visibleFrom="md" direction="column" justify="space-between" w="44%" maw={620} p={48} c="white" style={{ background: `linear-gradient(150deg, ${rail.bg} 0%, ${rail.raised} 60%, ${rail.active} 100%)` }}>
        <Group gap="md">
          {HERO_ICONS.map((name) => {
            const HeroIcon = Icon[name];
            return (
              <Center key={name} w={48} h={48} bg="rgba(255,255,255,0.07)" style={{ borderRadius: 14 }}>
                <HeroIcon size={22} />
              </Center>
            );
          })}
        </Group>
        <Box>
          <Text c="brand.4" fw={600} size="sm" mb="sm">
            {t('Trucking · Logistics · Operations')}
          </Text>
          <Title order={2} fz={34} lh={1.2} fw={600} maw={420}>
            {t('Every trip, every truck, one screen.')}
          </Title>
        </Box>
      </Flex>

      <Flex direction="column" style={{ flex: 1 }} p="lg">
        <Group justify="flex-end">
          <LanguageSwitcher />
        </Group>
        <Center style={{ flex: 1 }}>
          <Paper component="form" onSubmit={vm.submit} p={32} w="100%" maw={400} shadow="sm">
            <Stack gap="md">
              <Group gap="sm" wrap="nowrap">
                <BrandMark logoUrl={logoUrl} companyName={companyName} size={34} />
                <Text fw={700} truncate>
                  {companyName}
                </Text>
              </Group>
              <Box>
                <Title order={1} fz={24}>
                  {t('Sign in')}
                </Title>
                <Text c="dimmed" size="sm" mt={4}>
                  {t('Use your {company} credentials.').replace('{company}', companyName)}
                </Text>
              </Box>
              {vm.error && <Alert color="red">{t(vm.error)}</Alert>}
              {vm.notice && <Alert color="yellow">{t(vm.notice)}</Alert>}
              <TextInput label={t('Username')} value={vm.username} onChange={(event) => vm.setUsername(event.currentTarget.value)} autoComplete="username" required size="md" />
              <PasswordInput label={t('Password')} value={vm.password} onChange={(event) => vm.setPassword(event.currentTarget.value)} autoComplete="current-password" required size="md" />
              <Button type="submit" fullWidth size="md" loading={vm.submitting}>
                {t('Sign in')}
              </Button>
            </Stack>
          </Paper>
        </Center>
      </Flex>
    </Flex>
  );
}
