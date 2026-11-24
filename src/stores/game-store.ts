import { create } from 'zustand';

import { SESSION, answeredCount, type EthicalAnswer, type GameModeId, type PublicScenario, type SessionProgress } from '@/core';
import { getRepository } from '@/services/repository';
import type { AnswerOutcome, SessionSummary, StartSessionOptions } from '@/types/game';
import { toAppError } from '@/utils/errors';

export type GamePhase =
  | 'idle'
  | 'loading' // starting a session or waiting for more cards
  | 'ready' // a card is on screen and accepts input
  | 'submitting' // answer sent, waiting for the result
  | 'correct' // short positive feedback, then auto-advance
  | 'incorrect' // educational feedback, waits for the player
  | 'completing'
  | 'complete'
  | 'error';

interface GameState {
  mode: GameModeId | null;
  sessionId: string | null;
  plannedLength: number | null;
  queue: PublicScenario[];
  progress: SessionProgress | null;
  phase: GamePhase;
  outcome: AnswerOutcome | null;
  /** Incremented whenever a milestone is reached so the toast re-triggers. */
  milestone: { value: number; key: number } | null;
  difficultyNotice: { change: -1 | 1; key: number } | null;
  summary: SessionSummary | null;
  error: { message: string; retryable: boolean; during: 'start' | 'answer' | 'load' | 'finish' } | null;
  /** Remounts the current card (e.g. after a failed submission) so it returns to the centre. */
  cardResetKey: number;
  cardShownAt: number;

  start: (mode: GameModeId, options?: StartSessionOptions) => Promise<void>;
  answer: (selected: EthicalAnswer) => Promise<AnswerOutcome | null>;
  advance: () => void;
  finish: (status: 'completed' | 'abandoned') => Promise<SessionSummary | null>;
  retry: () => void;
  dismissError: () => void;
  reset: () => void;
}

// Guards that must be checked synchronously (before any await) to block double input.
let submitting = false;
let prefetching = false;
let startToken = 0;
let lastStart: { mode: GameModeId; options?: StartSessionOptions } | null = null;

const initial = {
  mode: null,
  sessionId: null,
  plannedLength: null,
  queue: [],
  progress: null,
  phase: 'idle' as GamePhase,
  outcome: null,
  milestone: null,
  difficultyNotice: null,
  summary: null,
  error: null,
  cardResetKey: 0,
  cardShownAt: 0,
};

export const useGameStore = create<GameState>()((set, get) => {
  async function prefetch(): Promise<void> {
    const { sessionId, queue, plannedLength, progress } = get();
    if (!sessionId || !progress || prefetching) return;
    if (queue.length > SESSION.refillWhen) return;
    if (plannedLength !== null && answeredCount(progress) + queue.length >= plannedLength) return;
    prefetching = true;
    const token = startToken;
    try {
      const more = await getRepository().nextScenarios(sessionId, SESSION.prefetchSize);
      if (token !== startToken) return; // a new session started meanwhile
      const known = new Set(get().queue.map((s) => s.id));
      const fresh = more.filter((s) => !known.has(s.id));
      set((state) => ({ queue: [...state.queue, ...fresh] }));
    } catch {
      // Silent: a foreground load will surface the error if the queue runs dry.
    } finally {
      prefetching = false;
    }
  }

  async function loadMoreOrFinish(): Promise<void> {
    const { sessionId } = get();
    if (!sessionId) return;
    set({ phase: 'loading' });
    const token = startToken;
    try {
      const more = await getRepository().nextScenarios(sessionId, SESSION.prefetchSize);
      if (token !== startToken) return;
      if (more.length === 0) {
        // Scenario bank exhausted for this session: end gracefully.
        await get().finish('completed');
        return;
      }
      set({ queue: more, phase: 'ready', cardShownAt: Date.now() });
    } catch (e) {
      const err = toAppError(e);
      set({ phase: 'error', error: { message: err.message, retryable: true, during: 'load' } });
    }
  }

  return {
    ...initial,

    start: async (mode, options) => {
      startToken += 1;
      const token = startToken;
      submitting = false;
      prefetching = false;
      lastStart = { mode, options };
      set({ ...initial, mode, phase: 'loading' });
      try {
        const started = await getRepository().startSession(mode, options);
        if (token !== startToken) return;
        set({
          sessionId: started.sessionId,
          plannedLength: started.plannedLength,
          queue: started.scenarios,
          progress: started.progress,
          phase: 'ready',
          cardShownAt: Date.now(),
        });
        void prefetch();
      } catch (e) {
        if (token !== startToken) return;
        const err = toAppError(e);
        set({ phase: 'error', error: { message: err.message, retryable: err.retryable, during: 'start' } });
      }
    },

    answer: async (selected) => {
      const state = get();
      const current = state.queue[0];
      // Synchronous guard: rapid swipes, swipe + button, or double taps are ignored.
      if (submitting || state.phase !== 'ready' || !current || !state.sessionId) return null;
      submitting = true;
      set({ phase: 'submitting' });
      const token = startToken;
      try {
        const outcome = await getRepository().submitAnswer({
          sessionId: state.sessionId,
          scenarioId: current.id,
          selected,
          responseMs: Math.max(0, Date.now() - state.cardShownAt),
        });
        if (token !== startToken) return null;
        const key = Date.now();
        set({
          outcome,
          progress: outcome.progress,
          phase: outcome.correct ? 'correct' : 'incorrect',
          milestone: outcome.milestone ? { value: outcome.milestone, key } : get().milestone,
          difficultyNotice:
            outcome.difficultyChange !== 0 ? { change: outcome.difficultyChange, key } : get().difficultyNotice,
        });
        void prefetch();
        return outcome;
      } catch (e) {
        if (token !== startToken) return null;
        const err = toAppError(e);
        // Put the card back so the player can try again.
        set((s) => ({
          phase: 'ready',
          cardResetKey: s.cardResetKey + 1,
          error: { message: err.message, retryable: err.retryable, during: 'answer' },
        }));
        return null;
      } finally {
        submitting = false;
      }
    },

    advance: () => {
      const { phase, queue, progress, plannedLength } = get();
      if (phase !== 'correct' && phase !== 'incorrect') return;
      const rest = queue.slice(1);
      set({ queue: rest, outcome: null });
      if (progress && plannedLength !== null && answeredCount(progress) >= plannedLength) {
        void get().finish('completed');
        return;
      }
      // Future modes with lives (Survival) can end the session here via GAME_MODES[mode].lives.
      if (rest.length === 0) {
        void loadMoreOrFinish();
        return;
      }
      set({ phase: 'ready', cardShownAt: Date.now() });
      void prefetch();
    },

    finish: async (status) => {
      const { sessionId, phase, summary } = get();
      if (summary) return summary;
      if (!sessionId || phase === 'completing') return null;
      set({ phase: 'completing' });
      try {
        const result = await getRepository().completeSession(sessionId, status);
        set({ summary: result, phase: 'complete' });
        return result;
      } catch (e) {
        const err = toAppError(e);
        set({ phase: 'error', error: { message: err.message, retryable: true, during: 'finish' } });
        return null;
      }
    },

    retry: () => {
      const { error } = get();
      if (!error) return;
      set({ error: null });
      if (error.during === 'start' && lastStart) void get().start(lastStart.mode, lastStart.options);
      else if (error.during === 'load') void loadMoreOrFinish();
      else if (error.during === 'finish') {
        set({ phase: 'ready' });
        void get().finish('completed');
      }
    },

    dismissError: () => set({ error: null }),

    reset: () => {
      startToken += 1;
      submitting = false;
      prefetching = false;
      set({ ...initial });
    },
  };
});
