'use client';

import { AppShell } from '../../components/AppShell';
import { PageHeader } from '../../components/PageHeader';
import { CrudView } from './CrudView';
import type { CrudDefinition, RowAction } from './types';
import { useCrudViewModel } from './use-crud-view-model';

/**
 * A complete CRUD page from one definition:
 *
 *   CrudScreen (page) → CrudView (View) → useCrudViewModel (ViewModel)
 *     → useResourceList / useResourceMutations (queries + mutations) → API client
 */
export function CrudScreen<T extends { id: number }>({ definition, rowActions }: { definition: CrudDefinition<T>; rowActions?: RowAction<T>[] }) {
  return (
    <AppShell title={definition.title}>
      <CrudScreenBody definition={definition} rowActions={rowActions} />
    </AppShell>
  );
}

/** Split out so the view model (and its queries) only mounts once AppShell has confirmed a session. */
function CrudScreenBody<T extends { id: number }>({ definition, rowActions }: { definition: CrudDefinition<T>; rowActions?: RowAction<T>[] }) {
  const vm = useCrudViewModel(definition);
  return (
    <>
      <PageHeader title={definition.title} description={definition.description} />
      <CrudView definition={definition} vm={vm} rowActions={rowActions} />
    </>
  );
}
