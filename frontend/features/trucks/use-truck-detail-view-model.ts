'use client';

import { useCallback, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { AssignmentDto, assignmentsApi } from '../../lib/api/assignments.api';
import { errorMessage } from '../../lib/api/errors';
import { trucksApi } from '../../lib/api/trucks.api';
import { toDateInput } from '../../lib/date';
import { newIdempotencyKey } from '../../lib/idempotency';
import { useT } from '../../lib/language-context';
import { useAuth } from '../auth/session-provider';
import { useTruckAssignments } from '../assignments/assignment.queries';
import { assignmentState } from '../assignments/assignment-state';
import { useResourceDetail, useResourceMutations } from '../crud/crud.queries';

const blankForm = () => ({ driverId: '', startDate: '', endDate: '' });
type AssignmentForm = ReturnType<typeof blankForm>;

/** One truck: its details, who drives it now, its assignment history, and assigning / editing / removing drivers. */
export function useTruckDetailViewModel(truckId: number) {
  const t = useT();
  const { can } = useAuth();
  const truck = useResourceDetail(trucksApi, truckId, { enabled: Number.isInteger(truckId) && truckId > 0 });
  const assignments = useTruckAssignments(truck.data ? truckId : null);
  const mutations = useResourceMutations(assignmentsApi);

  const history = useMemo(() => assignments.data ?? [], [assignments.data]);
  const current = useMemo(() => history.find((assignment) => assignmentState(assignment) === 'active') ?? null, [history]);

  const [form, setForm] = useState<AssignmentForm>(blankForm);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AssignmentDto | null>(null);
  const [editForm, setEditForm] = useState<AssignmentForm>(blankForm);
  const [editError, setEditError] = useState<string | null>(null);

  const { mutateAsync: create, isPending: assigning } = mutations.create;
  const { mutateAsync: update, isPending: savingEdit } = mutations.update;
  const { mutateAsync: removeAsync } = mutations.remove;

  const assign = useCallback(async () => {
    if (assigning || !form.driverId || !form.startDate) return;
    setFormError(null);
    try {
      await create({ values: { truckId, driverId: Number(form.driverId), startDate: form.startDate, endDate: form.endDate || undefined }, idempotencyKey });
      setForm(blankForm());
      setIdempotencyKey(newIdempotencyKey());
    } catch (error) {
      setFormError(errorMessage(error, 'Could not save assignment.'));
    }
  }, [assigning, form, create, truckId, idempotencyKey]);

  const openEdit = useCallback((assignment: AssignmentDto) => {
    setEditForm({ driverId: String(assignment.driverId), startDate: toDateInput(assignment.startDate), endDate: toDateInput(assignment.endDate) });
    setEditError(null);
    setEditing(assignment);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editing || savingEdit) return;
    setEditError(null);
    try {
      // endDate '' is sent on purpose: it clears the end date (the assignment becomes ongoing).
      await update({ id: editing.id, values: { driverId: Number(editForm.driverId), startDate: editForm.startDate, endDate: editForm.endDate } });
      setEditing(null);
    } catch (error) {
      setEditError(errorMessage(error, 'Could not save changes.'));
    }
  }, [editing, savingEdit, update, editForm]);

  const remove = useCallback(
    async (assignment: AssignmentDto) => {
      try {
        await removeAsync(assignment.id);
      } catch (error) {
        notifications.show({ color: 'red', message: t(errorMessage(error, 'Could not remove assignment.')) });
      }
    },
    [removeAsync, t],
  );

  return {
    truck: truck.data,
    loading: truck.isPending || (!!truck.data && assignments.isPending),
    error: truck.isError ? errorMessage(truck.error, 'Failed to load truck.') : assignments.isError ? errorMessage(assignments.error) : null,
    history,
    current,
    canAssign: can('assignments', 'add'),
    canEdit: can('assignments', 'edit'),
    canRemove: can('assignments', 'delete'),
    form,
    setForm,
    formError,
    assigning,
    assign,
    editing,
    editForm,
    setEditForm,
    editError,
    savingEdit,
    openEdit,
    closeEdit: () => setEditing(null),
    saveEdit,
    remove,
  };
}
