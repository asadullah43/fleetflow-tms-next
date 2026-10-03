import { toDateInput, toTimeInput } from '../../lib/date';
import { fileChange, fileValueOf } from '../files/file-value';
import type { FieldDef, FormValues } from './types';

/**
 * The fields a form shows — and so the only ones validated and sent — when
 * adding or editing: an edit-only field (a leave request's status) is not
 * part of a new record, even one duplicated from a row that has it.
 */
export function fieldsFor(fields: FieldDef[], mode: 'create' | 'edit'): FieldDef[] {
  return fields.filter((field) => !(field.createOnly && mode === 'edit') && !(field.editOnly && mode === 'create'));
}

/** Form values for a new record. */
export function emptyValues(fields: FieldDef[]): FormValues {
  return Object.fromEntries(fields.map((field) => [field.name, field.default ?? '']));
}

/** A stored row -> editable strings, by field type. */
export function rowToValues(fields: FieldDef[], row: Record<string, unknown>): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    const raw = row[field.name];
    switch (field.type) {
      case 'password':
      case 'display':
        values[field.name] = '';
        break;
      case 'custom':
        values[field.name] = field.default ?? '';
        break;
      case 'date':
        values[field.name] = toDateInput(raw as string | undefined);
        break;
      case 'time':
        values[field.name] = toTimeInput(raw as string | undefined);
        break;
      case 'file':
        values[field.name] = fileValueOf(row[field.fileFrom ?? field.name] as Parameters<typeof fileValueOf>[0]);
        break;
      case 'lookup':
        values[field.name] = raw ? String(raw) : ''; // 0 / null = no reference
        break;
      default:
        values[field.name] = raw === null || raw === undefined ? '' : String(raw);
    }
  }
  return values;
}

/**
 * Editable strings -> the API payload, by field type. References and
 * whole numbers become numbers; a blank optional reference, number or
 * password is left out (meaning "not set" on create, "unchanged" on edit).
 */
export function valuesToPayload(fields: FieldDef[], values: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.name] ?? '';
    switch (field.type) {
      case 'display':
      case 'custom':
        break;
      case 'file': {
        const change = fileChange(value);
        if (change !== undefined) payload[field.name] = change;
        break;
      }
      case 'lookup':
      case 'integer':
        if (value !== '') payload[field.name] = Number(value);
        break;
      case 'password':
        if (value !== '') payload[field.name] = value;
        break;
      case 'decimal':
        payload[field.name] = value.trim();
        break;
      default:
        payload[field.name] = typeof value === 'string' && field.type !== 'textarea' ? value.trim() : value;
    }
  }
  return payload;
}

/** Client-side checks that mirror the backend's validation, so most mistakes are caught before a round trip. */
export function validateValues(fields: FieldDef[], values: FormValues, mode: 'create' | 'edit'): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.type === 'display' || field.type === 'custom' || field.type === 'file') continue;
    const value = (values[field.name] ?? '').trim();
    const requiredNow = field.required && !(field.type === 'password' && mode === 'edit');
    if (requiredNow && value === '') errors[field.name] = 'This field is required.';
    else if (value !== '' && field.type === 'decimal' && !/^\d+(\.\d+)?$/.test(value)) errors[field.name] = 'Enter a number, e.g. 150 or 99.50.';
    else if (value !== '' && field.type === 'integer' && !/^\d+$/.test(value)) errors[field.name] = 'Enter a whole number.';
    else if (value !== '' && field.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) errors[field.name] = 'Enter a time, e.g. 08:30.';
  }
  return errors;
}
