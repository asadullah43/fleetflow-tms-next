'use client';

import { useCallback, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { errorMessage } from '../../lib/api/errors';
import { InvoiceDto, invoicesApi } from '../../lib/api/invoices.api';
import { newIdempotencyKey } from '../../lib/idempotency';
import { useT } from '../../lib/language-context';
import { usePagePermissions } from '../auth/session-provider';
import { useResourceList } from '../crud/crud.queries';
import { useListControls } from '../crud/use-list-controls';
import { DraftLine, filledLines, lineProblems, previewTotals } from './invoice-totals';
import { useInvoiceMutations } from './invoices.queries';

interface Draft {
  customerId: string;
  fromDate: string;
  toDate: string;
  dueDate: string;
  vatEnabled: boolean;
  lines: DraftLine[];
  idempotencyKey: string;
}

const emptyLine = (): DraftLine => ({ description: '', quantity: '1', rate: '0' });
const newDraft = (): Draft => ({ customerId: '', fromDate: '', toDate: '', dueDate: '', vatEnabled: true, lines: [emptyLine()], idempotencyKey: newIdempotencyKey() });

/** State and actions of the Invoices screen: the paged list, the new-invoice draft, and the open invoice's actions. */
export function useInvoicesViewModel() {
  const t = useT();
  const allowed = usePagePermissions();
  const controls = useListControls();
  const list = useResourceList(invoicesApi, controls.query, allowed.view);
  const mutations = useInvoiceMutations();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<InvoiceDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const openCreate = useCallback(() => {
    setDraft(newDraft());
    setDraftErrors({});
    setLineErrors({});
    setFormError(null);
  }, []);
  const closeCreate = useCallback(() => setDraft(null), []);
  const patchDraft = useCallback((patch: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...patch } : current)), []);
  const setLine = useCallback((index: number, patch: Partial<DraftLine>) => setDraft((current) => (current ? { ...current, lines: current.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)) } : current)), []);
  const addLine = useCallback(() => setDraft((current) => (current ? { ...current, lines: [...current.lines, emptyLine()] } : current)), []);
  const removeLine = useCallback((index: number) => setDraft((current) => (current && current.lines.length > 1 ? { ...current, lines: current.lines.filter((_, i) => i !== index) } : current)), []);

  const { mutateAsync: createInvoice, isPending: saving } = mutations.create;
  const save = useCallback(async () => {
    if (!draft || saving) return;
    const errors: Record<string, string> = {};
    if (!draft.customerId) errors.customerId = 'This field is required.';
    for (const name of ['fromDate', 'toDate', 'dueDate'] as const) if (!draft[name]) errors[name] = 'This field is required.';
    if (draft.fromDate && draft.toDate && draft.toDate < draft.fromDate) errors.toDate = 'The end date cannot be before the start date.';
    const problems = lineProblems(draft.lines);
    const lines = filledLines(draft.lines);
    setDraftErrors(errors);
    setLineErrors(problems);
    if (Object.keys(errors).length > 0 || Object.keys(problems).length > 0) return;
    if (lines.length === 0) {
      setFormError('An invoice needs at least one line item.');
      return;
    }
    setFormError(null);
    try {
      await createInvoice({
        values: { customerId: Number(draft.customerId), fromDate: draft.fromDate, toDate: draft.toDate, dueDate: draft.dueDate, vatEnabled: draft.vatEnabled, lineItems: lines.map((line) => ({ description: line.description.trim(), quantity: line.quantity.trim(), rate: line.rate.trim() })) },
        idempotencyKey: draft.idempotencyKey,
      });
      setDraft(null);
      notifications.show({ color: 'teal', message: t('Invoice created.') });
    } catch (error) {
      setFormError(errorMessage(error, 'Save failed.'));
    }
  }, [draft, saving, createInvoice, t]);

  const openView = useCallback((invoice: InvoiceDto) => {
    setActionError(null);
    setViewing(invoice);
  }, []);
  const closeView = useCallback(() => setViewing(null), []);

  const { mutateAsync: markPaidAsync } = mutations.markPaid;
  const { mutateAsync: submitAsync } = mutations.submitToZatca;
  const { mutateAsync: removeAsync } = mutations.remove;

  /** Runs an action on the open invoice and shows its updated state in place. */
  const runOnViewing = useCallback(
    async (action: (id: number) => Promise<InvoiceDto>, fallback: string) => {
      if (!viewing) return;
      setActionError(null);
      try {
        setViewing(await action(viewing.id));
      } catch (error) {
        setActionError(errorMessage(error, fallback));
      }
    },
    [viewing],
  );
  const markPaid = useCallback(() => runOnViewing(markPaidAsync, 'Failed to mark as paid.'), [runOnViewing, markPaidAsync]);
  const submitToZatca = useCallback(() => runOnViewing(submitAsync, 'ZATCA submission failed.'), [runOnViewing, submitAsync]);

  const remove = useCallback(
    async (invoice: InvoiceDto) => {
      try {
        await removeAsync(invoice.id);
        notifications.show({ color: 'teal', message: t('Record deleted.') });
      } catch (error) {
        notifications.show({ color: 'red', title: t('Delete failed.'), message: t(errorMessage(error, 'Delete failed.')) });
      }
    },
    [removeAsync, t],
  );

  return {
    allowed,
    controls,
    rows: list.data?.items,
    pagination: list.data?.pagination,
    loading: list.isPending && allowed.view,
    fetching: list.isFetching && !list.isPending,
    listError: list.isError ? errorMessage(list.error, 'Failed to load invoices.') : null,
    draft,
    draftErrors,
    lineErrors,
    formError,
    totals: previewTotals(draft?.lines ?? [], draft?.vatEnabled ?? true),
    saving,
    openCreate,
    closeCreate,
    patchDraft,
    setLine,
    addLine,
    removeLine,
    save,
    viewing,
    actionError,
    acting: mutations.markPaid.isPending || mutations.submitToZatca.isPending,
    openView,
    closeView,
    markPaid,
    submitToZatca,
    remove,
  };
}
