import { ActionItem, actions } from '../../components/action-items';
import type { PermissionAction } from '../../lib/permissions';

interface CrudRowActionsInput {
  allowed: Record<PermissionAction, boolean>;
  /** The screen's own actions for this row (e.g. "View history"); the first one stays visible. */
  custom?: ActionItem[];
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  deleting?: boolean;
}

/**
 * The row actions of every generic CRUD screen. Only a screen's own
 * "open this record" action is kept visible; Edit, Duplicate and Delete
 * always live in the 3-dot menu, each shown only with its permission
 * (edit / add / delete on the page's module).
 */
export function crudRowActions({ allowed, custom = [], onEdit, onDuplicate, onDelete, deleting }: CrudRowActionsInput): { primary?: ActionItem; items: ActionItem[] } {
  const [primary, ...rest] = custom;
  return {
    primary,
    items: [
      ...rest,
      actions.edit(onEdit, { hidden: !allowed.edit }),
      actions.duplicate(onDuplicate, { hidden: !allowed.add }),
      actions.delete(onDelete, { hidden: !allowed.delete, loading: deleting }),
    ],
  };
}
