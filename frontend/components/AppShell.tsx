'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Alert, AppShell as Shell, Avatar, Box, Burger, Button, Center, Collapse, Group, Loader, ScrollArea, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import { useDisclosure, useHover } from '@mantine/hooks';
import { useAuth, usePagePermissions } from '../features/auth/session-provider';
import { useBranding } from '../features/branding/use-branding';
import { useT } from '../lib/language-context';
import { NAV_GROUPS, NavGroup, NavItem } from '../lib/nav-config';
import { moduleForPath } from '../lib/permissions';
import { rail, surface } from '../theme/theme';
import { BrandMark } from './BrandMark';
import { Icon } from './icons';
import { LanguageSwitcher } from './LanguageSwitcher';

const isCurrent = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

function RailLink({ item, active, nested, onNavigate }: { item: NavItem; active: boolean; nested?: boolean; onNavigate: () => void }) {
  const t = useT();
  const { hovered, ref } = useHover<HTMLAnchorElement>();
  const ItemIcon = Icon[item.icon];
  return (
    <UnstyledButton
      ref={ref}
      component={Link}
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      display="flex"
      py={8}
      px={12}
      ps={nested ? 30 : 12}
      fz="sm"
      fw={active ? 600 : 500}
      c={active ? 'white' : hovered ? 'white' : rail.text}
      bg={active ? rail.active : hovered ? rail.raised : 'transparent'}
      style={{ alignItems: 'center', gap: 10, borderRadius: 8, borderInlineStart: `3px solid ${active ? 'var(--mantine-color-brand-6)' : 'transparent'}` }}
    >
      <ItemIcon size={16} />
      <Text span inherit truncate>
        {t(item.label)}
      </Text>
    </UnstyledButton>
  );
}

function RailGroup({ group, pathname, onNavigate }: { group: NavGroup; pathname: string; onNavigate: () => void }) {
  const t = useT();
  const { hovered, ref } = useHover<HTMLButtonElement>();
  // The group holding the current page starts open; every other one starts closed.
  const [open, setOpen] = useState(() => group.items.some((item) => isCurrent(pathname, item.href)));
  const GroupIcon = Icon[group.icon];
  return (
    <Box>
      <UnstyledButton
        ref={ref}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        display="flex"
        w="100%"
        py={8}
        px={12}
        fz="sm"
        fw={600}
        c={hovered ? 'white' : rail.muted}
        style={{ alignItems: 'center', gap: 10, borderRadius: 8 }}
      >
        <GroupIcon size={16} />
        <Text span inherit style={{ flex: 1 }}>
          {t(group.label)}
        </Text>
        <Box style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 120ms ease' }}>
          <Icon.chevronDown size={14} />
        </Box>
      </UnstyledButton>
      <Collapse in={open}>
        <Stack gap={2} pb={4}>
          {group.items.map((item) => (
            <RailLink key={item.href} item={item} nested active={isCurrent(pathname, item.href)} onNavigate={onNavigate} />
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}

/**
 * Shared shell for every signed-in page: the navigation rail, the top
 * bar, and the access guard — it redirects to the sign-in screen when
 * there is no session and shows only the pages the user's role may view.
 */
export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, connectionError, retry, logout, can } = useAuth();
  const page = usePagePermissions();
  const { companyName, logoUrl } = useBranding();
  const t = useT();
  const [navOpen, nav] = useDisclosure(false);

  const signedOut = !loading && !user && !connectionError;
  useEffect(() => {
    if (signedOut) router.replace('/login');
  }, [signedOut, router]);

  if (connectionError) {
    return (
      <Center mih="100vh" bg={surface.page} p="lg">
        <Alert color="red" title={t('Connection problem')} maw={420}>
          <Stack gap="sm" align="flex-start">
            <Text size="sm">{t(connectionError)}</Text>
            <Button size="xs" variant="light" color="red" onClick={retry}>
              {t('Try again')}
            </Button>
          </Stack>
        </Alert>
      </Center>
    );
  }

  if (loading || !user) {
    return (
      <Center mih="100vh" bg={surface.page}>
        <Loader aria-label={t('Loading...')} />
      </Center>
    );
  }

  // Only the pages this user's role can view; groups left empty disappear.
  const visibleGroups: NavGroup[] = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const pageModule = moduleForPath(item.href);
      return !pageModule || can(pageModule, 'view');
    }),
  })).filter((group) => group.items.length > 0);

  return (
    <Shell layout="alt" header={{ height: 60 }} navbar={{ width: 256, breakpoint: 'sm', collapsed: { mobile: !navOpen } }} padding="lg" bg={surface.page}>
      <Shell.Navbar bg={rail.bg} withBorder={false} aria-label={t('Main navigation')}>
        <Group gap={10} px={18} h={60} wrap="nowrap" style={{ borderBottom: `1px solid ${rail.border}` }}>
          <BrandMark logoUrl={logoUrl} companyName={companyName} size={30} />
          <Text c="white" fw={600} truncate style={{ flex: 1 }}>
            {companyName}
          </Text>
          <Burger opened={navOpen} onClick={nav.close} hiddenFrom="sm" size="sm" color="white" aria-label={t('Close')} />
        </Group>
        <ScrollArea flex={1} type="hover" scrollbarSize={6}>
          <Stack gap={4} p={10}>
            {visibleGroups.map((group) =>
              group.standalone ? (
                <RailLink key={group.label} item={group.items[0]} active={isCurrent(pathname, group.items[0].href)} onNavigate={nav.close} />
              ) : (
                <RailGroup key={group.label} group={group} pathname={pathname} onNavigate={nav.close} />
              ),
            )}
          </Stack>
        </ScrollArea>
      </Shell.Navbar>

      <Shell.Header bg="white" px="lg">
        <Group h="100%" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" miw={0}>
            <Burger opened={navOpen} onClick={nav.toggle} hiddenFrom="sm" size="sm" aria-label={t('Main navigation')} />
            <Title order={1} fz="lg" fw={600} lineClamp={1}>
              {t(title)}
            </Title>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <LanguageSwitcher />
            <Text size="sm" c="dimmed" visibleFrom="md" truncate maw={180}>
              {user.name}
            </Text>
            <Avatar color="brand" radius="xl" size={34} visibleFrom="xs">
              {user.name.slice(0, 1).toUpperCase()}
            </Avatar>
            <Button variant="default" size="xs" onClick={logout}>
              {t('Sign out')}
            </Button>
          </Group>
        </Group>
      </Shell.Header>

      <Shell.Main>
        {page.view ? (
          children
        ) : (
          <Alert color="yellow" title={t('No access')}>
            {t("You don't have permission to view this page.")}
          </Alert>
        )}
      </Shell.Main>
    </Shell>
  );
}
