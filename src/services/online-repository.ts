import type { SupabaseClient } from '@supabase/supabase-js';

import type { Category, GameModeId, PublicScenario } from '@/core';
import type { Database } from '@/types/database';
import {
  AppError,
  type AnswerOutcome,
  type AnswerSubmission,
  type GameRepository,
  type PlayerStats,
  type ReportReason,
  type ReviewItem,
  type SessionSummary,
  type StartSessionOptions,
  type StartedSession,
} from '@/types/game';

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Online repository. Scored actions go through Edge Functions (server-side validation);
 * read-only data comes straight from tables protected by Row Level Security.
 */
export class OnlineRepository implements GameRepository {
  readonly kind = 'online' as const;

  constructor(private supabase: SupabaseClient<Database>) {}

  private async userId(): Promise<string> {
    const { data } = await this.supabase.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new AppError('session_expired', 'Your session has expired. Please sign in again.');
    return id;
  }

  private async invoke<T>(fn: string, body: Record<string, unknown>, attempt = 1): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new AppError('timeout', 'The server is taking too long. Check your connection and try again.', true)),
        REQUEST_TIMEOUT_MS,
      );
    });
    try {
      const call = this.supabase.functions.invoke<T>(fn, { body });
      const { data, error } = await Promise.race([call, timeout]);
      if (error) {
        const parsed = await parseFunctionError(error);
        // A concurrent write raced us — one quick retry is safe (the server is idempotent).
        if (parsed.code === 'stale_session' && attempt < 3) return this.invoke<T>(fn, body, attempt + 1);
        throw parsed;
      }
      if (data === null || data === undefined) throw new AppError('empty_response', 'The server sent an empty response.', true);
      return data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('network', 'Could not reach the server. Check your internet connection.', true);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async getCategories(): Promise<Category[]> {
    const { data, error } = await this.supabase.from('categories').select('*').eq('active', true).order('sort_order');
    if (error) throw new AppError('db_error', error.message, true);
    return (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      icon: c.icon,
      color: c.color,
      active: c.active,
    }));
  }

  startSession(mode: GameModeId, options: StartSessionOptions = {}): Promise<StartedSession> {
    return this.invoke<StartedSession>('select-scenarios', { action: 'start', mode, scenarioIds: options.scenarioIds });
  }

  async nextScenarios(sessionId: string, count: number): Promise<PublicScenario[]> {
    const res = await this.invoke<{ scenarios: PublicScenario[] }>('select-scenarios', { action: 'next', sessionId, count });
    return res.scenarios;
  }

  submitAnswer(submission: AnswerSubmission): Promise<AnswerOutcome> {
    return this.invoke<AnswerOutcome>('submit-answer', { ...submission });
  }

  completeSession(sessionId: string, status: 'completed' | 'abandoned'): Promise<SessionSummary> {
    return this.invoke<SessionSummary>('complete-session', { sessionId, status });
  }

  async getPlayerStats(): Promise<PlayerStats> {
    const userId = await this.userId();
    const [profile, topics, sessions, pending] = await Promise.all([
      this.supabase.from('profiles').select('*').eq('id', userId).single(),
      this.supabase.from('user_topic_stats').select('*').eq('user_id', userId),
      this.supabase
        .from('game_sessions')
        .select('id, game_mode, score, correct_count, incorrect_count, highest_streak, xp_earned, current_difficulty, ending_difficulty, completed_at, session_status')
        .eq('user_id', userId)
        .neq('session_status', 'active')
        .order('started_at', { ascending: false })
        .limit(100),
      this.supabase
        .from('user_review_items')
        .select('scenario_id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('review_status', 'pending'),
    ]);
    if (profile.error) throw new AppError('db_error', profile.error.message, true);
    if (topics.error) throw new AppError('db_error', topics.error.message, true);
    if (sessions.error) throw new AppError('db_error', sessions.error.message, true);

    const topicStats: PlayerStats['topicStats'] = {};
    for (const t of topics.data ?? []) {
      topicStats[t.category_id] = {
        correct: t.correct_count,
        incorrect: t.incorrect_count,
        lastPracticedAt: t.last_practiced_at ? Date.parse(t.last_practiced_at) : null,
      };
    }
    const played = (sessions.data ?? []).filter((s) => s.correct_count + s.incorrect_count > 0);
    const bestScores: PlayerStats['bestScores'] = {};
    const bestStreaks: PlayerStats['bestStreaks'] = {};
    for (const s of played) {
      bestScores[s.game_mode] = Math.max(bestScores[s.game_mode] ?? 0, s.score);
      bestStreaks[s.game_mode] = Math.max(bestStreaks[s.game_mode] ?? 0, s.highest_streak);
    }
    const p = profile.data;
    return {
      username: p.username,
      totalXp: p.total_xp,
      highestStreak: p.highest_streak,
      totalAnswered: p.total_answered,
      totalCorrect: p.total_correct,
      sessionsCompleted: p.sessions_completed,
      currentDifficulty: p.current_difficulty,
      topicStats,
      recentSessions: played.slice(0, 30).map((s) => ({
        id: s.id,
        mode: s.game_mode,
        score: s.score,
        correct: s.correct_count,
        incorrect: s.incorrect_count,
        bestStreak: s.highest_streak,
        xpEarned: s.xp_earned,
        endingDifficulty: s.ending_difficulty ?? s.current_difficulty,
        completedAt: s.completed_at ? Date.parse(s.completed_at) : Date.now(),
        status: s.session_status === 'completed' ? 'completed' : 'abandoned',
      })),
      bestScores,
      bestStreaks,
      pendingReviewCount: pending.count ?? 0,
    };
  }

  async getReviewItems(): Promise<ReviewItem[]> {
    const { data, error } = await this.supabase.rpc('get_review_items');
    if (error) throw new AppError('db_error', error.message, true);
    return (data ?? []).map((r) => ({
      scenario: { id: r.scenario_id, categoryId: r.category_id, text: r.scenario_text, difficulty: r.difficulty_score },
      explanation: {
        correctAnswer: r.correct_answer,
        explanation: r.explanation,
        ethicalPrinciples: r.ethical_principles,
        recommendedAction: r.recommended_action,
        learningObjective: r.learning_objective,
      },
      selected: r.last_selected_answer,
      timesMissed: r.times_missed,
      lastMissedAt: Date.parse(r.last_missed_at),
      reviewed: r.review_status === 'reviewed',
      reviewedAt: r.reviewed_at ? Date.parse(r.reviewed_at) : null,
    }));
  }

  async markReviewed(scenarioId: string): Promise<void> {
    const { error } = await this.supabase.rpc('mark_review_item_reviewed', { p_scenario_id: scenarioId });
    if (error) throw new AppError('db_error', error.message, true);
  }

  async reportScenario(scenarioId: string, reason: ReportReason, description?: string): Promise<void> {
    const userId = await this.userId();
    const { error } = await this.supabase
      .from('scenario_reports')
      .insert({ user_id: userId, scenario_id: scenarioId, reason, description: description ?? null });
    // A second report of the same scenario by the same player is fine to ignore.
    if (error && error.code !== '23505') throw new AppError('db_error', error.message, true);
  }

  async updateUsername(username: string): Promise<void> {
    const userId = await this.userId();
    const { error } = await this.supabase.from('profiles').update({ username }).eq('id', userId);
    if (error) {
      if (error.code === '23505') throw new AppError('username_taken', 'That username is already taken.');
      if (error.code === '23514') throw new AppError('invalid_username', 'Use 3–24 letters, numbers, dots, dashes or underscores.');
      throw new AppError('db_error', error.message, true);
    }
  }
}

/** Converts a functions.invoke error into an AppError with the server's code + message. */
async function parseFunctionError(error: unknown): Promise<AppError> {
  const context = (error as { context?: unknown }).context;
  if (context && typeof (context as Response).json === 'function') {
    try {
      const body = (await (context as Response).json()) as { error?: { code?: string; message?: string } };
      const code = body.error?.code ?? 'server_error';
      const retryable = ['stale_session', 'internal', 'db_error', 'rate_limited'].includes(code);
      return new AppError(code, body.error?.message ?? 'Something went wrong.', retryable);
    } catch {
      // fall through
    }
  }
  const name = (error as { name?: string }).name;
  if (name === 'FunctionsFetchError') {
    return new AppError('network', 'Could not reach the server. Check your internet connection.', true);
  }
  return new AppError('server_error', 'Something went wrong. Please try again.', true);
}

