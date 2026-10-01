'use client';

import { Checkbox, Table } from '@mantine/core';
import type { PermissionDto } from '../../lib/api/roles.api';
import { useT } from '../../lib/language-context';
import { formatModule } from '../../lib/permissions';

export { formatModule };

type Flag = keyof Omit<PermissionDto, 'module'>;
const FLAGS: { flag: Flag; label: string }[] = [
  { flag: 'canView', label: 'View' },
  { flag: 'canAdd', label: 'Add' },
  { flag: 'canEdit', label: 'Edit' },
  { flag: 'canDelete', label: 'Delete' },
];

export function emptyPermissions(modules: string[]): PermissionDto[] {
  return modules.map((module) => ({ module, canView: false, canAdd: false, canEdit: false, canDelete: false }));
}

/** One row per module; rows for modules missing from `existing` start with nothing granted. */
export function fillPermissions(modules: string[], existing: PermissionDto[]): PermissionDto[] {
  const byModule = new Map(existing.map((permission) => [permission.module, permission]));
  return emptyPermissions(modules).map((blank) => ({ ...blank, ...byModule.get(blank.module) }));
}

/** The module × view/add/edit/delete grid, used for roles and for API keys. */
export function PermissionMatrix({ value, onChange, disabledModules = [] }: { value: PermissionDto[]; onChange: (next: PermissionDto[]) => void; disabledModules?: string[] }) {
  const t = useT();
  const toggle = (module: string, flag: Flag) => onChange(value.map((row) => (row.module === module ? { ...row, [flag]: !row[flag] } : row)));

  return (
    <Table.ScrollContainer minWidth={420} mah={360}>
      <Table withTableBorder verticalSpacing={6} stickyHeader>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('Module')}</Table.Th>
            {FLAGS.map(({ flag, label }) => (
              <Table.Th key={flag} ta="center">
                {t(label)}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {value.map((row) => (
            <Table.Tr key={row.module}>
              <Table.Td>{t(formatModule(row.module))}</Table.Td>
              {FLAGS.map(({ flag, label }) => (
                <Table.Td key={flag}>
                  <Checkbox
                    checked={row[flag]}
                    onChange={() => toggle(row.module, flag)}
                    disabled={disabledModules.includes(row.module)}
                    aria-label={`${t(formatModule(row.module))}: ${t(label)}`}
                    styles={{ body: { justifyContent: 'center' } }}
                  />
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
