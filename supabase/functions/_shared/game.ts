import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { HttpError } from './http.ts';
import type { EthicalAnswer, GameModeId, PublicScenario, SessionProgress } from './core/types.ts';
import type { SelectionCandidate } from './core/selection.ts';

export interface SessionRow {
  id: string;
  user_id: string;
  game_mode: GameModeId;
  session_status: 'active' | 'completed' | 'abandoned';
  score: number;
  correct_count: number;
  incorrect_count: number;
  current_streak: number;
  highest_streak: number;
  xp_earned: number;
  starting_difficulty: number;
  current_difficulty: number;
  max_difficulty: number;
  ending_difficulty: number | null;
  answers_since_adjustment: number;
  consecutive_incorrect: number;
  planned_length: number | null;
  served_scenario_ids: string[];
  category_results: Record<string, { correct: number; incorrect: number }>;
  started_at: string;
  completed_at: string | null;
}

export function rowToProgress(row: SessionRow): SessionProgress {
  return {
    mode: row.game_mode,
    score: row.score,
    correct: row.correct_count,
    incorrect: row.incorrect_count,
    streak: row.current_streak,
    bestStreak: row.highest_streak,
    xpEarned: row.xp_earned,
    startingDifficulty: row.starting_difficulty,
    difficulty: row.current_difficulty,
    maxDifficulty: row.max_difficulty,
    answersSinceAdjustment: row.answers_since_adjustment,
    consecutiveIncorrect: row.consecutive_incorrect,
    categoryResults: row.category_results ?? {},
  };
}

export async function loadOwnSession(admin: SupabaseClient, sessionId: string, userId: string): Promise<SessionRow> {
  const { data, error } = await admin.from('game_sessions').select('*').eq('id', sessionId).maybeSingle();
  if (error) throw new HttpError(500, 'db_error', error.message);
  if (!data || data.user_id !== userId) throw new HttpError(404, 'session_not_found', 'Session not found.');
  return data as SessionRow;
}

export interface PoolRow extends SelectionCandidate {
  correctAnswer: EthicalAnswer;
}

/** Approved scenarios as selection candidates (answers stay server-side). */
export async function loadApprovedPool(admin: SupabaseClient): Promise<PoolRow[]> {
  const { data, error } = await admin
    .from('scenarios')
    .select('id, category_id, difficulty_score, correct_answer, categories!inner(active)')
    .eq('approval_status', 'approved')
    .eq('categories.active', true)
    .limit(5000);
  if (error) throw new HttpError(500, 'db_error', error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    categoryId: r.category_id as string,
    difficulty: r.difficulty_score as number,
    correctAnswer: r.correct_answer as EthicalAnswer,
  }));
}

/** Fetches public scenario fields (never the answer) for the given ids, preserving order. */
export async function loadPublicScenarios(admin: SupabaseClient, ids: string[]): Promise<PublicScenario[]> {
  if (ids.length === 0) return [];
  const { data, error } = await admin
    .from('scenarios')
    .select('id, category_id, scenario_text, difficulty_score')
    .in('id', ids);
  if (error) throw new HttpError(500, 'db_error', error.message);
  const byId = new Map(
    (data ?? []).map((r: Record<string, unknown>) => [
      r.id as string,
      { id: r.id as string, categoryId: r.category_id as string, text: r.scenario_text as string, difficulty: r.difficulty_score as number },
    ]),
  );
  return ids.map((id) => byId.get(id)).filter((s): s is PublicScenario => Boolean(s));
}

export async function logGeneration(
  admin: SupabaseClient,
  entry: {
    model: string;
    operation: 'generate' | 'assess' | 'validate';
    requested: number;
    generated: number;
    accepted: number;
    status: 'success' | 'partial' | 'failed';
    errors?: unknown;
    durationMs: number;
    requestedBy?: string;
  },
): Promise<void> {
  const { error } = await admin.from('ai_generation_logs').insert({
    model_identifier: entry.model,
    operation: entry.operation,
    requested_count: entry.requested,
    generated_count: entry.generated,
    accepted_count: entry.accepted,
    validation_status: entry.status,
    error_details: entry.errors ?? null,
    duration_ms: entry.durationMs,
    requested_by: entry.requestedBy ?? null,
  });
  if (error) console.error('Failed to write ai_generation_logs', error.message);
}

/** Simple global rate limit for AI operations using the generation log. */
export async function enforceAiRateLimit(admin: SupabaseClient): Promise<void> {
  const limit = Number(Deno.env.get('GENERATION_HOURLY_LIMIT') ?? '10');
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from('ai_generation_logs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since);
  if (error) throw new HttpError(500, 'db_error', error.message);
  if ((count ?? 0) >= limit) {
    throw new HttpError(429, 'rate_limited', `AI operation limit of ${limit} per hour reached. Try again later.`);
  }
}
