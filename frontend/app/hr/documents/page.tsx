'use client';

import { useEffect, useMemo, useState } from 'react';
import { CrudPage } from '../../../components/CrudPage';
import { AppShell } from '../../../components/AppShell';
import { useAuth } from '../../../lib/auth-context';
import { useLanguage } from '../../../lib/language-context';
import { localizedName } from '../../../lib/localized-name';
import { employeesClient, employeeDocumentsClient, EmployeeDocumentDto } from '../../../lib/grpc/hr';

type Opt = { value: string; label: string }[];

export default function EmployeeDocumentsPage() {
  const { token } = useAuth();
  const { language } = useLanguage();
  const [opts, setOpts] = useState<{ employees: Opt } | null>(null);
  const [docTypes, setDocTypes] = useState<string[]>([]);

  useEffect(() => {
    if (!token) return;
    Promise.all([employeesClient.list(token), employeeDocumentsClient.list(token)]).then(([emps, docs]) => {
      setOpts({ employees: emps.map((e) => ({ value: String(e.id), label: localizedName(e, language) })) });
      setDocTypes(Array.from(new Set(docs.map((d) => d.documentType).filter(Boolean))).sort());
    });
  }, [token, language]);

  const filterBar = useMemo(
    () => ({
      fields: [
        { name: 'employee', label: 'Employee', options: opts?.employees.map((o) => o.label) ?? [] },
        { name: 'documentType', label: 'Document Type', options: docTypes },
      ],
      apply: (r: EmployeeDocumentDto, f: Record<string, string>) => {
        const match = (field: string | undefined, needle: string | undefined) =>
          !needle || (field ?? '').toLowerCase().includes(needle.toLowerCase());
        return match(r.employeeName, f.employee) && match(r.documentType, f.documentType);
      },
    }),
    [opts, docTypes],
  );

  if (!opts) {
    return (
      <AppShell title="Documents">
        <div className="empty-state">Loading...</div>
      </AppShell>
    );
  }

  return (
    <CrudPage<EmployeeDocumentDto>
      title="Documents"
      description="Employee identification and compliance documents, with expiry tracking."
      addLabel="Document"
      emptyLabel="No employee documents yet."
      filterBar={filterBar}
      columns={[
        { header: 'Employee', render: (r) => r.employeeName ?? r.employeeId },
        { header: 'Type', render: (r) => r.documentType },
        { header: 'Expiry', render: (r) => (r.expiryDate ? r.expiryDate.slice(0, 10) : '—') },
      ]}
      fetchAll={() => employeeDocumentsClient.list(token!)}
      onCreate={(v) => employeeDocumentsClient.create({ ...v, employeeId: Number(v.employeeId) }, token!)}
      onUpdate={(id, v) => employeeDocumentsClient.update(id, { ...v, employeeId: Number(v.employeeId) }, token!)}
      onDelete={(id) => employeeDocumentsClient.remove(id, token!)}
      formFields={[
        { name: 'employeeId', label: 'Employee', type: 'select', options: opts.employees, required: true },
        { name: 'documentType', label: 'Document type', required: true },
        { name: 'documentNumber', label: 'Document number' },
        { name: 'issueDate', label: 'Issue date', type: 'date' },
        { name: 'expiryDate', label: 'Expiry date', type: 'date' },
        { name: 'fileUrl', label: 'File URL' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ]}
      emptyValues={{ employeeId: '', documentType: '', documentNumber: '', issueDate: '', expiryDate: '', fileUrl: '', notes: '' }}
      toFormValues={(r) => ({
        employeeId: String(r.employeeId),
        documentType: r.documentType,
        documentNumber: r.documentNumber ?? '',
        issueDate: r.issueDate?.slice(0, 10) ?? '',
        expiryDate: r.expiryDate?.slice(0, 10) ?? '',
        fileUrl: r.fileUrl ?? '',
        notes: r.notes ?? '',
      })}
    />
  );
}
