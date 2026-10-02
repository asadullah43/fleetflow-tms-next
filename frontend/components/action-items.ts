import type { IconName } from './icons';

export interface ActionItem {
  /** Untranslated label (ActionMenu translates it). */
  label: string;
  icon: IconName;
  onClick: () => void;
  /** Destructive: listed last, after a divider, in red. */
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Leave the action out (e.g. not permitted, or not applicable to this row). */
  hidden?: boolean;
}

/** Per-use state of an action: permission / applicability, and progress. */
export type ActionState = Pick<ActionItem, 'hidden' | 'disabled' | 'loading'>;

const make =
  (label: string, icon: IconName, danger = false) =>
  (onClick: () => void, state: ActionState = {}): ActionItem => ({ label, icon, onClick, ...(danger ? { danger } : {}), ...state });

/**
 * Every action offered in an ActionMenu, built here and only here: each
 * label is bound to its icon (and destructive styling) once, so a screen
 * supplies just the handler and its permission check — a "View" can
 * never be dressed as "Duplicate" by a copy-paste slip. The architecture
 * test in test/app-logic.test.ts rejects action literals built anywhere else.
 */
export const actions = {
  // Opening a record
  view: make('View', 'eye'),
  viewHistory: make('View history', 'eye'),
  openPdf: make('Open PDF', 'fileText'),
  // Changing a record
  edit: make('Edit', 'pencil'),
  duplicate: make('Duplicate', 'copy'),
  markPaid: make('Mark as paid', 'check'),
  submitToZatca: make('Submit to ZATCA', 'send'),
  // Removing a record (each resource's own word for it)
  delete: make('Delete', 'trash', true),
  deleteBatch: make('Delete batch', 'trash', true),
  remove: make('Remove', 'trash', true),
  revoke: make('Revoke', 'trash', true),
  // Page level
  exportExcel: make('Export to Excel', 'gridLayers'),
  exportPdf: make('Export to PDF', 'fileText'),
  /** The page's "add" button; `noun` is the untranslated singular ("Truck"). */
  add: (noun: string, onClick: () => void, state: ActionState = {}): ActionItem => ({ label: noun, icon: 'plus', onClick, ...state }),
};
