import type { ReactNode } from 'react';
import type { Lookup } from '../../components/AsyncSelect';
import type { CrudApi } from '../../lib/api/crud-api';
import type { IconName } from '../../components/icons';
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

export type FieldType = 'text' | 'textarea' | 'password' | 'integer' | 'decimal' | 'date' | 'select' | 'lookup' | 'display';

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

export interface RowAction<T> {
  label: string;
  icon: IconName;
  onClick: (row: T) => void;
}

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
  /** Adjusts the automatically derived form values when a row is opened for editing. */
  toFormValues?: (values: FormValues, row: T, ctx: DisplayContext) => FormValues;
}
