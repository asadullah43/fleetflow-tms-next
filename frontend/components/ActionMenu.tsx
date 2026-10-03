'use client';

import { ActionIcon, Button, Group, Menu, Tooltip, useDirection } from '@mantine/core';
import { useT } from '../lib/language-context';
import { tone } from '../theme/theme';
import type { ActionItem } from './action-items';
import { Icon } from './icons';

export type { ActionItem };

interface ActionMenuProps {
  /** The one action kept visible next to the menu. */
  primary?: ActionItem;
  /** Everything else, inside the 3-dot menu. */
  items?: ActionItem[];
  /** `icon` (table rows): the primary action is an icon button. `button` (toolbars): a labelled button. */
  layout?: 'icon' | 'button';
}

/**
 * The one way actions are offered anywhere in the app: the primary action
 * stays visible, every secondary one (edit, delete, view, duplicate,
 * export, change status, ...) sits in a 3-dot menu. Destructive actions
 * always come last, separated and in red. Renders nothing when no action
 * is available, so callers can pass permission-filtered lists as-is.
 * Items come from `actions` in ./action-items (label and icon bound once).
 */
export function ActionMenu({ primary, items = [], layout = 'icon' }: ActionMenuProps) {
  const t = useT();
  const { dir } = useDirection();
  const visiblePrimary = primary && !primary.hidden ? primary : undefined;
  const visible = items.filter((item) => !item.hidden);
  const regular = visible.filter((item) => !item.danger);
  const danger = visible.filter((item) => item.danger);
  if (!visiblePrimary && visible.length === 0) return null;

  const PrimaryGlyph = visiblePrimary ? Icon[visiblePrimary.icon] : null;
  const busy = visible.some((item) => item.loading);
  const renderItem = (item: ActionItem) => {
    const ItemGlyph = Icon[item.icon];
    return (
      <Menu.Item key={item.label} leftSection={<ItemGlyph size={15} />} color={item.danger ? 'red' : undefined} disabled={item.disabled || item.loading} onClick={item.onClick}>
        {t(item.label)}
      </Menu.Item>
    );
  };

  return (
    <Group gap={6} wrap="nowrap" justify="flex-end">
      {visiblePrimary &&
        PrimaryGlyph &&
        (layout === 'button' ? (
          <Button size="sm" leftSection={<PrimaryGlyph size={15} />} onClick={visiblePrimary.onClick} disabled={visiblePrimary.disabled} loading={visiblePrimary.loading}>
            {t(visiblePrimary.label)}
          </Button>
        ) : (
          <Tooltip label={t(visiblePrimary.label)} withArrow>
            <ActionIcon {...tone.primarySoft} size="md" aria-label={t(visiblePrimary.label)} onClick={visiblePrimary.onClick} disabled={visiblePrimary.disabled} loading={visiblePrimary.loading}>
              <PrimaryGlyph size={16} />
            </ActionIcon>
          </Tooltip>
        ))}
      {visible.length > 0 && (
        <Menu position={dir === 'rtl' ? 'bottom-start' : 'bottom-end'} shadow="md" width={210} withinPortal>
          <Tooltip label={t('More actions')} withArrow>
            <Menu.Target>
              <ActionIcon {...tone.quiet} size={layout === 'button' ? 36 : 'md'} aria-label={t('More actions')} loading={busy}>
                <Icon.dots size={16} />
              </ActionIcon>
            </Menu.Target>
          </Tooltip>
          <Menu.Dropdown>
            {regular.map(renderItem)}
            {regular.length > 0 && danger.length > 0 && <Menu.Divider />}
            {danger.map(renderItem)}
          </Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );
}
