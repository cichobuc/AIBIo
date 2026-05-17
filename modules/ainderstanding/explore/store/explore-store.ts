'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ExploreState {
  activeQuerySessionId: string | null;
  setActiveQuerySessionId: (id: string | null) => void;
}

export const useExploreStore = create<ExploreState>()(
  persist(
    (set) => ({
      activeQuerySessionId: null,
      setActiveQuerySessionId: (id) => set({ activeQuerySessionId: id }),
    }),
    {
      name: 'aibio-explore',
      partialize: (s) => ({ activeQuerySessionId: s.activeQuerySessionId }),
    },
  ),
);
