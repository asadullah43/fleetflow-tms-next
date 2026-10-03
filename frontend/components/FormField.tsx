'use client';

import { Input, PasswordInput, Select, Text, Textarea, TextInput } from '@mantine/core';
import { DateInput, TimeInput } from '@mantine/dates';
import { FileUploadInput } from '../features/files/FileUploadInput';
import type { DisplayContext, FieldDef, FormValues } from '../features/crud/types';
import { AsyncSelect } from './AsyncSelect';

interface FormFieldProps {
  field: FieldDef;
  values: FormValues;
  error?: string;
  ctx: DisplayContext;
  onChange: (name: string, value: string) => void;
  /** Passwords are optional when editing (blank = keep the current one). */
  mode: 'create' | 'edit';
}

/** Renders one declared form field as the matching Mantine input. */
export function FormField({ field, values, error, ctx, onChange, mode }: FormFieldProps) {
  const { t } = ctx;
  const value = values[field.name] ?? '';
  const common = {
    label: t(field.label),
    description: field.hint ? t(field.hint) : undefined,
    error: error ? t(error) : undefined,
    required: field.required && !(field.type === 'password' && mode === 'edit'),
  };
  const set = (next: string) => onChange(field.name, next);

  switch (field.type) {
    case 'file':
      if (!field.purpose) throw new Error(`Field "${field.name}" is a file without a purpose`);
      return (
        <Input.Wrapper label={common.label} description={common.description} error={common.error}>
          <FileUploadInput purpose={field.purpose} value={value} onChange={set} />
        </Input.Wrapper>
      );
    case 'custom':
      return (
        <Input.Wrapper label={common.label} description={common.description} error={common.error}>
          {field.input?.({ value, onChange: set, ctx })}
        </Input.Wrapper>
      );
    case 'display':
      return (
        <Input.Wrapper label={common.label} description={common.description}>
          <Text size="sm" py={8} px={12} mt={2} bg="sand.0" c={field.render ? undefined : 'dimmed'} style={{ borderRadius: 8, border: '1px solid var(--mantine-color-sand-2)' }}>
            {field.render?.(values, ctx) ?? '—'}
          </Text>
        </Input.Wrapper>
      );
    case 'lookup':
      if (!field.lookup) throw new Error(`Field "${field.name}" is a lookup without a lookup definition`);
      return <AsyncSelect {...common} lookup={field.lookup} value={value} onChange={set} />;
    case 'select':
      return (
        <Select
          {...common}
          data={(field.options ?? []).map((option) => ({ value: option.value, label: t(option.label) }))}
          value={value || null}
          onChange={(next) => set(next ?? '')}
          allowDeselect={!field.required}
          comboboxProps={{ withinPortal: true }}
        />
      );
    case 'date':
      return <DateInput {...common} value={value || null} onChange={(next) => set(next ?? '')} valueFormat="YYYY-MM-DD" placeholder="YYYY-MM-DD" clearable={!field.required} popoverProps={{ withinPortal: true }} />;
    case 'time':
      return <TimeInput {...common} value={value} onChange={(event) => set(event.currentTarget.value)} dir="ltr" />;
    case 'textarea':
      return <Textarea {...common} value={value} onChange={(event) => set(event.currentTarget.value)} autosize minRows={2} maxRows={6} />;
    case 'password':
      return <PasswordInput {...common} value={value} onChange={(event) => set(event.currentTarget.value)} autoComplete="new-password" />;
    case 'integer':
    case 'decimal':
      return <TextInput {...common} value={value} onChange={(event) => set(event.currentTarget.value)} inputMode={field.type === 'integer' ? 'numeric' : 'decimal'} dir="ltr" />;
    default:
      return <TextInput {...common} value={value} onChange={(event) => set(event.currentTarget.value)} />;
  }
}
