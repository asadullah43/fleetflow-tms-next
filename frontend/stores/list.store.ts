'use client';

import { create } from 'zustand';
import type { SortState } from '../components/DataTable';
import { DEFAULT_PAGE_SIZE } from '../lib/api/types';

export interface ListState {
  search: string;
  filters: Record<string, string>;
  sort: SortState | null;
  page: number;
  pageSize: number;
}

export const EMPTY_LIST: ListState = { search: '', filters: {}, sort: null, page: 1, pageSize: DEFAULT_PAGE_SIZE };

interface ListStore {
  /** One entry per list, keyed by scope (the page's path, or a widget name). */
  lists: Record<string, ListState>;
  patch: (scope: string, changes: Partial<ListState>, defaults?: Partial<ListState>) => void;
  /** Opens a list already narrowed to `filters` (e.g. from a dashboard card): other criteria are cleared. */
  preset: (scope: string, filters: Record<string, string>) => void;
  /** Forgets every list (on sign-out: one user's filters never carry over to the next). */
  reset: () => void;
}

/**
 * The search / filter / sort / page of every server-driven list, in one
 * place. Because it outlives the page, leaving a list (to a detail page,
 * or elsewhere) and coming back restores exactly what was being looked at
 * — the same query key, so the cached page is reused instead of refetched.
 */
export const useListStore = create<ListStore>()((set) => ({
  lists: {},
  patch: (scope, changes, defaults) =>
    set((state) => ({ lists: { ...state.lists, [scope]: { ...EMPTY_LIST, ...defaults, ...state.lists[scope], ...changes } } })),
  preset: (scope, filters) =>
    set((state) => ({ lists: { ...state.lists, [scope]: { ...EMPTY_LIST, pageSize: state.lists[scope]?.pageSize ?? DEFAULT_PAGE_SIZE, filters } } })),
  reset: () => set({ lists: {} }),
}));
