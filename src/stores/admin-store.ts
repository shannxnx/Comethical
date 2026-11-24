import { create } from 'zustand';

import { adminApi } from '@/features/admin/admin-api';
import type { AdminFilter, AdminScenario, AdminStats, GenerateRequest, ScenarioPatch } from '@/features/admin/types';
import { toAppError } from '@/utils/errors';

interface AdminState {
  filter: AdminFilter;
  scenarios: AdminScenario[];
  stats: AdminStats | null;
  loading: boolean;
  generating: boolean;
  /** Scenario ids with an action in flight (buttons show a spinner, double taps are ignored). */
  busy: Record<string, boolean>;
  error: string | null;
  notice: string | null;
  setFilter: (filter: AdminFilter) => void;
  refresh: () => Promise<void>;
  generate: (req: GenerateRequest) => Promise<boolean>;
  save: (id: string, patch: ScenarioPatch, approve: boolean) => Promise<boolean>;
  reassess: (id: string) => Promise<void>;
  setStatus: (id: string, status: 'approved' | 'rejected' | 'pending') => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearMessages: () => void;
}

export const useAdminStore = create<AdminState>()((set, get) => {
  const replace = (s: AdminScenario | null | undefined) => {
    if (!s) return;
    set((st) => ({ scenarios: st.scenarios.map((x) => (x.id === s.id ? s : x)) }));
  };
  const withBusy = async (id: string, fn: () => Promise<void>) => {
    if (get().busy[id]) return;
    set((st) => ({ busy: { ...st.busy, [id]: true }, error: null }));
    try {
      await fn();
    } catch (e) {
      set({ error: toAppError(e).message });
    } finally {
      set((st) => {
        const { [id]: _done, ...rest } = st.busy;
        return { busy: rest };
      });
    }
  };

  return {
    filter: 'pending',
    scenarios: [],
    stats: null,
    loading: false,
    generating: false,
    busy: {},
    error: null,
    notice: null,

    setFilter: (filter) => {
      set({ filter });
      void get().refresh();
    },

    refresh: async () => {
      const filter = get().filter;
      set({ loading: true, error: null });
      try {
        const res = await adminApi.list(filter);
        if (get().filter === filter) set({ scenarios: res.scenarios, stats: res.stats });
      } catch (e) {
        set({ error: toAppError(e).message });
      } finally {
        set({ loading: false });
      }
    },

    generate: async (req) => {
      if (get().generating) return false;
      set({ generating: true, error: null, notice: null });
      try {
        const res = await adminApi.generate(req);
        set({ notice: res.message });
        // Show the new drafts at the top of the Drafts view.
        set({ filter: 'pending' });
        await get().refresh();
        return res.created.length > 0;
      } catch (e) {
        set({ error: toAppError(e).message });
        return false;
      } finally {
        set({ generating: false });
      }
    },

    save: async (id, patch, approve) => {
      let ok = false;
      await withBusy(id, async () => {
        const res = await adminApi.update(id, patch, approve);
        replace(res.scenario);
        ok = true;
        set({ notice: approve ? 'Saved and published to players.' : 'Changes saved.' });
      });
      if (ok) void get().refresh();
      return ok;
    },

    reassess: (id) =>
      withBusy(id, async () => {
        const res = await adminApi.reassess(id);
        replace(res.scenario);
        set({ notice: 'Difficulty re-checked by Gemini.' });
      }),

    setStatus: (id, status) =>
      withBusy(id, async () => {
        await adminApi.setStatus([id], status);
        set({ notice: status === 'approved' ? 'Approved — now live for players.' : status === 'rejected' ? 'Rejected.' : 'Moved back to drafts.' });
        await get().refresh();
      }),

    remove: (id) =>
      withBusy(id, async () => {
        await adminApi.remove(id);
        set((st) => ({ scenarios: st.scenarios.filter((s) => s.id !== id), notice: 'Deleted.' }));
        void get().refresh();
      }),

    clearMessages: () => set({ error: null, notice: null }),
  };
});
