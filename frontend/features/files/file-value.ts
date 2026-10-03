import type { FileInfoDto } from '../../lib/api/files.api';

/**
 * A form's file field keeps, as its (string) value, the file attached
 * when the form opened and the one chosen now. Only a difference is sent:
 * the new file's id, or 0 to remove the attached one.
 */
export interface FileValue {
  file: FileInfoDto | null;
  original: FileInfoDto | null;
}

export function parseFileValue(value: string): FileValue {
  try {
    const parsed = JSON.parse(value || 'null') as Partial<FileValue> | null;
    return { file: parsed?.file ?? null, original: parsed?.original ?? null };
  } catch {
    return { file: null, original: null };
  }
}

/** The value for a record's attached file ('' when there is none). */
export function fileValueOf(attached: FileInfoDto | null | undefined): string {
  return attached ? JSON.stringify({ file: attached, original: attached }) : '';
}

/** `value` with `file` chosen instead (null = removed). */
export function withChosenFile(value: string, file: FileInfoDto | null): string {
  const { original } = parseFileValue(value);
  return file || original ? JSON.stringify({ file, original }) : '';
}

/** What to send: undefined when unchanged, the chosen file's id, or 0 to remove the attached one. */
export function fileChange(value: string): number | undefined {
  const { file, original } = parseFileValue(value);
  if ((file?.id ?? null) === (original?.id ?? null)) return undefined;
  return file ? file.id : 0;
}
