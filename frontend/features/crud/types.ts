import type { ReactNode } from 'react';
import type { Lookup } from '../../components/AsyncSelect';
import type { CrudApi } from '../../lib/api/crud-api';
import type { ActionItem } from '../../components/action-items';
import type { FilePurpose } from '../../lib/api/files.api';
import type { PermissionAction } from '../../lib/permissions';
import type { Language } from '../../lib/language-context';

/** What a column / field definition may use to produce display text. */
export interface DisplayContext {
  language: Language;
  t: (text: string) => string;
}

export interface Option {
  value: string;
  label: string;
}

export interface ColumnDef<T> {
  header: string;
  /** The cell's plain text — what is shown (unless `kind` says otherwise), exported and printed. */
  value: (row: T, ctx: DisplayContext) => string | number | null | undefined;
  /** text (default), mono for codes/numbers, status for a coloured status badge (value = the status code). */
  kind?: 'text' | 'mono' | 'status';
  align?: 'left' | 'right';
  /** Server-side sort field (must be one the backend list declares). */
  sortKey?: string;
  /** Makes the cell a link to this path. */
  href?: (row: T) => string;
}

export type FieldType = 'text' | 'textarea' | 'password' | 'integer' | 'decimal' | 'date' | 'time' | 'select' | 'lookup' | 'display' | 'custom' | 'file';

export interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  /** For `select`. */
  options?: Option[];
  /** For `lookup`: the resource to search and pick from. */
  lookup?: Lookup;
  /** Value on a new record. */
  default?: string;
  /** For `display`: read-only content derived from the other values (not sent to the server). */
  render?: (values: FormValues, ctx: DisplayContext) => ReactNode;
  /** Shown under the input. */
  hint?: string;
  /**
   * For `custom`: renders the whole input. Its value is a string like every other (e.g. JSON);
   * it is not sent as-is — the definition's `toApi` turns it into payload. Shown full width, below the other fields.
   */
  input?: (props: { value: string; onChange: (value: string) => void; ctx: DisplayContext }) => ReactNode;
  /** Only on the "add" form (not when editing). */
  createOnly?: boolean;
  /** Only when editing (not on the "add" form, where the default is used). */
  editOnly?: boolean;
  /**
   * For `file`: an uploaded file (PDF / image). `name` is the id sent to the API (e.g. fileId) — only when it changes,
   * 0 to remove — and `fileFrom` the row property holding the attached file's details (e.g. file). Shown full width.
   */
  purpose?: FilePurpose;
  fileFrom?: string;
}

/** A server-side filter shown above the table. `name` is the backend filter name. */
export interface FilterDef {
  name: string;
  label: string;
  type: 'select' | 'date' | 'lookup';
  options?: Option[];
  lookup?: Lookup;
}

/** All form values are strings while editing; they are converted for the API on save. */
export type FormValues = Record<string, string>;

/** What a row action may need to know besides its row: the caller's permissions on the page. */
export interface RowActionContext {
  allowed: Record<PermissionAction, boolean>;
}

/** A screen's own action for one row, built with `actions` from components/action-items (e.g. `(row) => actions.viewHistory(() => open(row))`). */
export type RowAction<T> = (row: T, context: RowActionContext) => ActionItem;

/** Everything that makes one list/create/edit/delete screen: declared once, rendered by CrudScreen. */
export interface CrudDefinition<T extends { id: number }> {
  api: CrudApi<T>;
  title: string;
  description?: string;
  /** Singular noun for the add button and form title ("Truck"). */
  addLabel: string;
  emptyLabel: string;
  searchPlaceholder?: string;
  columns: ColumnDef<T>[];
  fields: FieldDef[];
  filters?: FilterDef[];
  /** Adjusts the automatically converted payload before it is sent (rarely needed). */
  toApi?: (payload: Record<string, unknown>, values: FormValues, mode: 'create' | 'edit') => Record<string, unknown>;
  /** Other resources a save or delete changes (their cached queries are refreshed too), e.g. stock a work order used. */
  invalidates?: string[];
  /**
   * Keeps values that follow from others up to date as the user types (e.g. hours worked from time in / out):
   * gets the values after a change, the values before it and the changed field's name; returns the values to use.
   */
  derive?: (next: FormValues, previous: FormValues, changed: string) => FormValues;
  /** Adjusts the automatically derived form values when a row is opened for editing. */
  toFormValues?: (values: FormValues, row: T, ctx: DisplayContext) => FormValues;
}
