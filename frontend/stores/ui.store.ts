'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type DashboardTab = 'operations' | 'hr' | 'workshop' | 'inventory' | 'map';

interface UiState {
  /** Desktop rail shows icons only. Ignored on small screens, where the rail is a full-width drawer. */
  sidebarCollapsed: boolean;
  /** Sidebar groups the user opened or closed (by group label). Groups never toggled follow the current page: open when it is in them. */
  navGroupOpen: Record<string, boolean>;
  /** The dashboard tab last looked at. */
  dashboardTab: DashboardTab;
  toggleSidebar: () => void;
  setNavGroupOpen: (label: string, open: boolean) => void;
  setDashboardTab: (tab: DashboardTab) => void;
}

/**
 * App-wide UI preferences — client state only, never server data. Kept in
 * localStorage so they survive reloads; the shell is client-rendered only
 * after the session check, so reading storage on creation cannot cause a
 * hydration mismatch.
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      navGroupOpen: {},
      dashboardTab: 'operations',
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setNavGroupOpen: (label, open) => set((state) => ({ navGroupOpen: { ...state.navGroupOpen, [label]: open } })),
      setDashboardTab: (dashboardTab) => set({ dashboardTab }),
    }),
    { name: 'fleetflow_ui', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
