import { create } from 'zustand';

import { DEFAULT_CATEGORIES, type Category } from '@/core';
import { getRepository } from '@/services/repository';
import type { PlayerStats } from '@/types/game';
import { toAppError } from '@/utils/errors';

interface StatsState {
  stats: PlayerStats | null;
  categories: Category[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadCategories: () => Promise<void>;
  clear: () => void;
}

export const useStatsStore = create<StatsState>()((set, get) => ({
  stats: null,
  categories: [...DEFAULT_CATEGORIES],
  loading: false,
  error: null,

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const stats = await getRepository().getPlayerStats();
      set({ stats, loading: false });
    } catch (e) {
      set({ loading: false, error: toAppError(e).message });
    }
  },

  loadCategories: async () => {
    try {
      const categories = await getRepository().getCategories();
      if (categories.length > 0) set({ categories });
    } catch {
      // Keep bundled defaults when offline.
    }
  },

  clear: () => set({ stats: null, error: null }),
}));

/** Category lookup that tolerates ids missing from the catalogue. */
export function useCategory(categoryId: string | undefined): Category {
  const categories = useStatsStore((s) => s.categories);
  return (
    categories.find((c) => c.id === categoryId) ?? {
      id: categoryId ?? 'unknown',
      name: 'General',
      description: '',
      icon: 'help-circle',
      color: '#94A3B8',
      active: true,
    }
  );
}
