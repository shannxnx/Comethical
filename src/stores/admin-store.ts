import { create } from 'zustand';

import { DIFFICULTY_TIERS } from '@/core';
import { adminApi } from '@/features/admin/admin-api';
import { inviteApi, type AdminInvite } from '@/features/admin/invite-api';
import {
  DEFAULT_LIBRARY_FILTERS,
  type AdminScenario,
  type AdminSection,
  type AdminStats,
  type GenerateRequest,
  type LibraryFilters,
  type ListQuery,
  type ReviewFilter,
  type ScenarioPatch,
} from '@/features/admin/types';
import { toAppError } from '@/utils/errors';

const PAGE = 30;

/** Translates the Library filters into an API query. */
export function libraryQuery(f: LibraryFilters): ListQuery {
  const tier = f.tierId ? DIFFICULTY_TIERS.find((t) => t.id === f.tierId) : undefined;
  const q: ListQuery = {
    search: f.search.trim() || undefined,
    categoryId: f.categoryId ?? undefined,
    minDifficulty: tier?.min,
    maxDifficulty: tier?.max,
    source: f.source ?? undefined,
  };
  if (f.visibility === 'in_game') Object.assign(q, { statuses: ['approved'], inGame: true });
  else if (f.visibility === 'hidden') Object.assign(q, { statuses: ['approved'], inGame: false });
  else if (f.visibility === 'not_approved') q.statuses = ['pending', 'flagged', 'rejected'];
  return q;
}

interface AdminState {
  section: AdminSection;
  stats: AdminStats | null;
  error: string | null;
  notice: string | null;
  /** Scenario ids with an action in flight (spinners + double-tap protection). */
  busy: Record<string, boolean>;

  generating: boolean;

  reviewFilter: ReviewFilter;
  reviewItems: AdminScenario[];
  reviewLoading: boolean;

  filters: LibraryFilters;
  libraryItems: AdminScenario[];
  libraryMatching: number;
  libraryLoading: boolean;
  libraryLoadingMore: boolean;

  invites: AdminInvite[];
  invitesLoading: boolean;

  setSection: (s: AdminSection) => void;
  refreshReview: () => Promise<void>;
  setReviewFilter: (f: ReviewFilter) => void;
  refreshLibrary: () => Promise<void>;
  loadMoreLibrary: () => Promise<void>;
  setFilters: (patch: Partial<LibraryFilters>) => void;
  resetFilters: () => void;
  refreshCurrent: () => Promise<void>;
  refreshInvites: () => Promise<void>;
  revokeInvite: (id: string) => Promise<void>;

  generate: (req: GenerateRequest) => Promise<boolean>;
  save: (id: string, patch: ScenarioPatch, approve: boolean) => Promise<boolean>;
  reassess: (id: string) => Promise<void>;
  setStatus: (id: string, status: 'approved' | 'rejected' | 'pending') => Promise<void>;
  setInGame: (id: string, inGame: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearMessages: () => void;
  findScenario: (id: string) => AdminScenario | undefined;
}

let libraryRequest = 0;
let reviewRequest = 0;

export const useAdminStore = create<AdminState>()((set, get) => {
  const replaceEverywhere = (updated: AdminScenario[]) => {
    const byId = new Map(updated.map((s) => [s.id, s]));
    const swap = (list: AdminScenario[]) => list.map((s) => byId.get(s.id) ?? s);
    set((st) => ({ reviewItems: swap(st.reviewItems), libraryItems: swap(st.libraryItems) }));
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
        const next = { ...st.busy };
        delete next[id];
        return { busy: next };
      });
    }
  };

  return {
    section: 'library',
    stats: null,
    error: null,
    notice: null,
    busy: {},
    generating: false,
    reviewFilter: 'pending',
    reviewItems: [],
    reviewLoading: false,
    filters: DEFAULT_LIBRARY_FILTERS,
    libraryItems: [],
    libraryMatching: 0,
    libraryLoading: false,
    libraryLoadingMore: false,
    invites: [],
    invitesLoading: false,

    setSection: (section) => {
      set({ section });
      void get().refreshCurrent();
    },

    refreshCurrent: async () => {
      const { section } = get();
      if (section === 'review') await get().refreshReview();
      else if (section === 'library') await get().refreshLibrary();
      else if (section === 'invites') await get().refreshInvites();
      else await get().refreshReview(); // keeps the stats fresh on the Generate screen
    },

    refreshInvites: async () => {
      set({ invitesLoading: true });
      try {
        const res = await inviteApi.list();
        set({ invites: res.invites });
      } catch (e) {
        set({ error: toAppError(e).message });
      } finally {
        set({ invitesLoading: false });
      }
    },

    revokeInvite: (id) =>
      withBusy(id, async () => {
        const res = await inviteApi.revoke(id);
        const updated = res.invite;
        if (updated) set((st) => ({ invites: st.invites.map((i) => (i.id === id ? updated : i)) }));
      }),

    refreshReview: async () => {
      const token = ++reviewRequest;
      set({ reviewLoading: true });
      try {
        const res = await adminApi.list({ statuses: [get().reviewFilter], limit: 100 });
        if (token === reviewRequest) set({ reviewItems: res.scenarios, stats: res.stats });
      } catch (e) {
        if (token === reviewRequest) set({ error: toAppError(e).message });
      } finally {
        if (token === reviewRequest) set({ reviewLoading: false });
      }
    },

    setReviewFilter: (reviewFilter) => {
      set({ reviewFilter, reviewItems: [] });
      void get().refreshReview();
    },

    refreshLibrary: async () => {
      const token = ++libraryRequest;
      set({ libraryLoading: true });
      try {
        const res = await adminApi.list({ ...libraryQuery(get().filters), limit: PAGE, offset: 0 });
        if (token === libraryRequest) set({ libraryItems: res.scenarios, libraryMatching: res.matching, stats: res.stats });
      } catch (e) {
        if (token === libraryRequest) set({ error: toAppError(e).message });
      } finally {
        if (token === libraryRequest) set({ libraryLoading: false });
      }
    },

    loadMoreLibrary: async () => {
      const { libraryItems, libraryMatching, libraryLoadingMore, libraryLoading } = get();
      if (libraryLoadingMore || libraryLoading || libraryItems.length >= libraryMatching) return;
      const token = libraryRequest;
      set({ libraryLoadingMore: true });
      try {
        const res = await adminApi.list({ ...libraryQuery(get().filters), limit: PAGE, offset: libraryItems.length });
        if (token !== libraryRequest) return;
        const known = new Set(get().libraryItems.map((s) => s.id));
        set((st) => ({ libraryItems: [...st.libraryItems, ...res.scenarios.filter((s) => !known.has(s.id))], libraryMatching: res.matching }));
      } catch (e) {
        set({ error: toAppError(e).message });
      } finally {
        set({ libraryLoadingMore: false });
      }
    },

    setFilters: (patch) => {
      set((st) => ({ filters: { ...st.filters, ...patch } }));
      void get().refreshLibrary();
    },

    resetFilters: () => {
      set({ filters: DEFAULT_LIBRARY_FILTERS });
      void get().refreshLibrary();
    },

    generate: async (req) => {
      if (get().generating) return false;
      set({ generating: true, error: null, notice: null });
      try {
        const res = await adminApi.generate(req);
        set({ notice: res.message });
        if (res.created.length > 0) {
          // New drafts wait in Review.
          set({ section: 'review', reviewFilter: 'pending' });
          await get().refreshReview();
        }
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
        if (res.scenario) replaceEverywhere([res.scenario]);
        ok = true;
        set({ notice: approve ? 'Saved and approved: it is now in games.' : 'Changes saved.' });
      });
      if (ok) void get().refreshCurrent();
      return ok;
    },

    reassess: (id) =>
      withBusy(id, async () => {
        const res = await adminApi.reassess(id);
        if (res.scenario) replaceEverywhere([res.scenario]);
        set({
          notice: res.scenario?.difficultyFactors
            ? 'Difficulty re-checked by Gemini.'
            : 'Gemini re-scored the difficulty but skipped the factor breakdown. Try Re-check again.',
        });
      }),

    setStatus: (id, status) =>
      withBusy(id, async () => {
        const res = await adminApi.setStatus([id], status);
        replaceEverywhere(res.scenarios);
        set({
          notice: status === 'approved' ? 'Approved: now in games.' : status === 'rejected' ? 'Rejected.' : 'Moved back to drafts (out of games).',
        });
        await get().refreshCurrent();
      }),

    setInGame: (id, inGame) =>
      withBusy(id, async () => {
        // Optimistic: flip immediately, roll back on failure.
        replaceEverywhere(get().libraryItems.filter((s) => s.id === id).map((s) => ({ ...s, inGame })));
        try {
          const res = await adminApi.setInGame([id], inGame);
          replaceEverywhere(res.scenarios);
          set((st) => ({
            stats: st.stats ? { ...st.stats, live: st.stats.live + (inGame ? 1 : -1), hidden: st.stats.hidden + (inGame ? -1 : 1) } : st.stats,
          }));
        } catch (e) {
          replaceEverywhere(get().libraryItems.filter((s) => s.id === id).map((s) => ({ ...s, inGame: !inGame })));
          throw e;
        }
      }),

    remove: (id) =>
      withBusy(id, async () => {
        await adminApi.remove(id);
        set((st) => ({
          reviewItems: st.reviewItems.filter((s) => s.id !== id),
          libraryItems: st.libraryItems.filter((s) => s.id !== id),
          libraryMatching: Math.max(0, st.libraryMatching - 1),
          notice: 'Deleted.',
        }));
      }),

    clearMessages: () => set({ error: null, notice: null }),

    findScenario: (id) => get().reviewItems.find((s) => s.id === id) ?? get().libraryItems.find((s) => s.id === id),
  };
});
