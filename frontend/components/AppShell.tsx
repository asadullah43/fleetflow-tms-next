'use client';

import { ReactNode, Ref, useEffect, useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Alert, AppShell as Shell, Avatar, Box, Burger, Button, Center, Collapse, Group, Loader, Menu, ScrollArea, Stack, Text, Title, Tooltip, UnstyledButton, useDirection } from '@mantine/core';
import { useDisclosure, useHover, useMediaQuery, useMergedRef } from '@mantine/hooks';
import { useAuth, usePagePermissions } from '../features/auth/session-provider';
import { useBranding } from '../features/branding/use-branding';
import { useT } from '../lib/language-context';
import { NAV_GROUPS, NavGroup, NavItem } from '../lib/nav-config';
import { moduleForPath } from '../lib/permissions';
import { useUiStore } from '../stores/ui.store';
import { rail, surface, tone } from '../theme/theme';
import { BrandMark } from './BrandMark';
import { Icon } from './icons';
import { LanguageSwitcher } from './LanguageSwitcher';

const RAIL_WIDTH = 256;
const RAIL_WIDTH_COLLAPSED = 72;

const isCurrent = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Tooltips and fly-outs open towards the page, away from the rail — right in LTR, left in RTL. */
function useOutward(): 'right' | 'left' {
  return useDirection().dir === 'rtl' ? 'left' : 'right';
}

/** One rail entry's look: highlighted when active, raised on hover; icon-only when the rail is collapsed. */
function RailButton({ icon, label, active, nested, collapsed, trailing, ref: outerRef, ...rest }: { icon: NavItem['icon']; label: string; active: boolean; nested?: boolean; collapsed: boolean; trailing?: ReactNode; ref?: Ref<HTMLElement> } & Record<string, unknown>) {
  const { hovered, ref: hoverRef } = useHover<HTMLElement>();
  // Tooltip and Menu.Target hand their own ref in (a plain prop in React 19); both must reach the element.
  const ref = useMergedRef(hoverRef, outerRef);
  const ItemIcon = Icon[icon];
  return (
    <UnstyledButton
      ref={ref}
      {...rest}
      display="flex"
      w="100%"
      h={collapsed ? 44 : undefined}
      py={collapsed ? 0 : 8}
      px={collapsed ? 0 : 12}
      ps={collapsed ? 0 : nested ? 30 : 12}
      fz="sm"
      fw={active ? 600 : 500}
      c={active || hovered ? 'white' : rail.text}
      bg={active ? rail.active : hovered ? rail.raised : 'transparent'}
      aria-label={collapsed ? label : undefined}
      style={{
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 10,
        borderRadius: 8,
        borderInlineStart: `3px solid ${active ? 'var(--mantine-color-brand-6)' : 'transparent'}`,
      }}
    >
      <ItemIcon size={collapsed ? 19 : 16} />
      {!collapsed && (
        <Text span inherit truncate style={{ flex: 1 }}>
          {label}
        </Text>
      )}
      {!collapsed && trailing}
    </UnstyledButton>
  );
}

function RailLink({ item, active, nested, collapsed, onNavigate }: { item: NavItem; active: boolean; nested?: boolean; collapsed: boolean; onNavigate: () => void }) {
  const t = useT();
  const side = useOutward();
  const label = t(item.label);
  const link = <RailButton component={Link} href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined} icon={item.icon} label={label} active={active} nested={nested} collapsed={collapsed} />;
  return collapsed ? (
    <Tooltip label={label} position={side} withArrow offset={12}>
      {link}
    </Tooltip>
  ) : (
    link
  );
}

function RailGroup({ group, pathname, collapsed, onNavigate }: { group: NavGroup; pathname: string; collapsed: boolean; onNavigate: () => void }) {
  const t = useT();
  const side = useOutward();
  const holdsCurrent = group.items.some((item) => isCurrent(pathname, item.href));
  const choice = useUiStore((state) => state.navGroupOpen[group.label]);
  const setOpen = useUiStore((state) => state.setNavGroupOpen);
  // Never toggled: open when it holds the current page.
  const open = choice ?? holdsCurrent;
  // Auto-expanding is remembered as if the user had opened it, so the group stays open after
  // navigating elsewhere: leaving a page never collapses its group and shifts the rail under the cursor.
  useEffect(() => {
    if (holdsCurrent && choice === undefined) setOpen(group.label, true);
  }, [holdsCurrent, choice, setOpen, group.label]);

  // Collapsed: the group's icon opens a fly-out listing its pages.
  if (collapsed) {
    return (
      <Menu trigger="click-hover" position={side === 'right' ? 'right-start' : 'left-start'} offset={12} openDelay={60} closeDelay={120} shadow="md" width={220} withinPortal>
        <Menu.Target>
          <RailButton icon={group.icon} label={t(group.label)} active={holdsCurrent} collapsed aria-haspopup="menu" />
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{t(group.label)}</Menu.Label>
          {group.items.map((item) => {
            const ItemIcon = Icon[item.icon];
            const active = isCurrent(pathname, item.href);
            return (
              <Menu.Item
                key={item.href}
                component={Link}
                href={item.href}
                onClick={onNavigate}
                leftSection={<ItemIcon size={15} />}
                aria-current={active ? 'page' : undefined}
                fw={active ? 600 : undefined}
                c={active ? 'brand.7' : undefined}
              >
                {t(item.label)}
              </Menu.Item>
            );
          })}
        </Menu.Dropdown>
      </Menu>
    );
  }

  return (
    <Box>
      <RailButton
        onClick={() => setOpen(group.label, !open)}
        aria-expanded={open}
        icon={group.icon}
        label={t(group.label)}
        active={false}
        collapsed={false}
        trailing={
          <Box style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 120ms ease', display: 'flex' }}>
            <Icon.chevronDown size={14} />
          </Box>
        }
      />
      <Collapse in={open}>
        <Stack gap={2} pb={4}>
          {group.items.map((item) => (
            <RailLink key={item.href} item={item} nested active={isCurrent(pathname, item.href)} collapsed={false} onNavigate={onNavigate} />
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}

/**
 * Where the rail was scrolled to. Every screen renders its own AppShell, so
 * navigating mounts a fresh rail; without this its scroll container would
 * start back at the top on every click. A plain module value rather than
 * store state: it changes on every scroll event and nothing renders from it.
 */
let railScrollTop = 0;

/** The rail's scrollable list, restored to the previous rail's offset before the first paint. */
function RailScroll({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (viewport.current) viewport.current.scrollTop = railScrollTop;
  }, []);
  return (
    <ScrollArea flex={1} type="hover" scrollbarSize={6} viewportRef={viewport} onScrollPositionChange={({ y }) => (railScrollTop = y)}>
      {children}
    </ScrollArea>
  );
}

/** Desktop-only control at the foot of the rail; the choice is remembered on this device. */
function CollapseToggle({ collapsed }: { collapsed: boolean }) {
  const t = useT();
  const side = useOutward();
  const toggle = useUiStore((state) => state.toggleSidebar);
  const label = t(collapsed ? 'Expand sidebar' : 'Collapse sidebar');
  // Collapsing moves towards the rail's own edge (start); expanding, away from it.
  const pointsStart = !collapsed === (side === 'right');
  const Glyph = pointsStart ? Icon.chevronStart : Icon.chevronEnd;
  return (
    <Box p={10} visibleFrom="sm" style={{ borderTop: `1px solid ${rail.border}` }}>
      <Tooltip label={label} position={side} withArrow offset={12} disabled={!collapsed}>
        <UnstyledButton
          onClick={toggle}
          aria-label={label}
          aria-expanded={!collapsed}
          display="flex"
          w="100%"
          h={36}
          px={collapsed ? 0 : 12}
          fz="sm"
          c={rail.muted}
          bg={rail.raised}
          style={{ alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10, borderRadius: 8 }}
        >
          <Glyph size={16} />
          {!collapsed && <Text span inherit>{label}</Text>}
        </UnstyledButton>
      </Tooltip>
    </Box>
  );
}

/**
 * Shared shell for every signed-in page: the navigation rail (collapsible
 * to icons on desktop), the top bar, and the access guard — it redirects
 * to the sign-in screen when there is no session and shows only the
 * pages the user's role may view.
 */
export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, connectionError, retry, logout, can } = useAuth();
  const page = usePagePermissions();
  const { companyName, logoUrl } = useBranding();
  const t = useT();
  const [navOpen, nav] = useDisclosure(false);
  const collapsedPreference = useUiStore((state) => state.sidebarCollapsed);
  // Below the `sm` breakpoint the rail is a full-width drawer, always with labels.
  // Read synchronously: the default (read after paint) would flash a collapsed rail open on every page mount.
  const desktop = useMediaQuery('(min-width: 48em)', undefined, { getInitialValueInEffect: false });
  const collapsed = collapsedPreference && desktop === true;

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
            <Button size="xs" color="red.7" onClick={retry}>
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
    <Shell
      layout="alt"
      header={{ height: 60 }}
      navbar={{ width: collapsed ? RAIL_WIDTH_COLLAPSED : RAIL_WIDTH, breakpoint: 'sm', collapsed: { mobile: !navOpen } }}
      padding="lg"
      bg={surface.page}
      transitionDuration={180}
    >
      <Shell.Navbar bg={rail.bg} withBorder={false} aria-label={t('Main navigation')}>
        <Group gap={10} px={collapsed ? 0 : 18} h={60} wrap="nowrap" justify={collapsed ? 'center' : 'flex-start'} style={{ borderBottom: `1px solid ${rail.border}`, flexShrink: 0 }}>
          <BrandMark logoUrl={logoUrl} companyName={companyName} size={30} />
          {!collapsed && (
            <Text c="white" fw={600} truncate style={{ flex: 1 }}>
              {companyName}
            </Text>
          )}
          <Burger opened={navOpen} onClick={nav.close} hiddenFrom="sm" size="sm" color="white" aria-label={t('Close')} />
        </Group>
        <RailScroll>
          <Stack gap={4} p={10}>
            {visibleGroups.map((group) =>
              group.standalone ? (
                <RailLink key={group.label} item={group.items[0]} active={isCurrent(pathname, group.items[0].href)} collapsed={collapsed} onNavigate={nav.close} />
              ) : (
                <RailGroup key={group.label} group={group} pathname={pathname} collapsed={collapsed} onNavigate={nav.close} />
              ),
            )}
          </Stack>
        </RailScroll>
        <CollapseToggle collapsed={collapsed} />
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
            <Button {...tone.secondary} size="xs" onClick={logout}>
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
