// Scenario selection: starts a session and serves the next scenarios.
// Answers are NEVER included in the response.
import { HttpError, isUuid, json, readJson, requireUuid, serve } from '../_shared/http.ts';
import { adminClient, requireUser } from '../_shared/supabase.ts';
import { loadApprovedPool, loadOwnSession, loadPublicScenarios, rowToProgress, type PoolRow, type SessionRow } from '../_shared/game.ts';
import { GAME_MODES, SESSION, isGameModeId } from '../_shared/core/game.config.ts';
import { ADAPTIVE_DIFFICULTY } from '../_shared/core/difficulty.config.ts';
import { categoryWeakness, selectReviewScenarios, selectScenarios } from '../_shared/core/selection.ts';
import { createSessionProgress } from '../_shared/core/session.ts';
import type { CategoryTally } from '../_shared/core/types.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const MAX_SESSIONS_PER_HOUR = 60;

async function playerContext(admin: SupabaseClient, userId: string) {
  const [recent, stats, review] = await Promise.all([
    admin.from('user_answers').select('scenario_id').eq('user_id', userId).order('answered_at', { ascending: false }).limit(SESSION.recentAvoidWindow),
    admin.from('user_topic_stats').select('category_id, correct_count, incorrect_count').eq('user_id', userId),
    admin
      .from('user_review_items')
      .select('scenario_id, review_status, times_missed, last_missed_at')
      .eq('user_id', userId)
      .order('times_missed', { ascending: false })
      .order('last_missed_at', { ascending: false })
      .limit(200),
  ]);
  for (const r of [recent, stats, review]) if (r.error) throw new HttpError(500, 'db_error', r.error.message);
  const tallies: Record<string, CategoryTally> = {};
  for (const s of stats.data ?? []) tallies[s.category_id] = { correct: s.correct_count, incorrect: s.incorrect_count };
  return {
    recentIds: new Set<string>((recent.data ?? []).map((r) => r.scenario_id as string)),
    weakness: categoryWeakness(tallies),
    pendingReviewIds: (review.data ?? []).filter((r) => r.review_status === 'pending').map((r) => r.scenario_id as string),
    allReviewIds: new Set<string>((review.data ?? []).map((r) => r.scenario_id as string)),
  };
}

async function start(admin: SupabaseClient, userId: string, body: Record<string, unknown>) {
  const mode = body.mode;
  if (!isGameModeId(mode)) throw new HttpError(400, 'invalid_request', 'Unknown game mode.');
  const definition = GAME_MODES[mode];

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count: recentSessions } = await admin
    .from('game_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('started_at', since);
  if ((recentSessions ?? 0) >= MAX_SESSIONS_PER_HOUR) {
    throw new HttpError(429, 'rate_limited', 'Too many sessions started. Take a short break and try again.');
  }

  // Only one active session per player: close any unfinished one.
  await admin
    .from('game_sessions')
    .update({ session_status: 'abandoned', completed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('session_status', 'active');

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('current_difficulty')
    .eq('id', userId)
    .single();
  if (profileError) throw new HttpError(500, 'db_error', profileError.message);
  const startingDifficulty = (profile?.current_difficulty as number | undefined) ?? ADAPTIVE_DIFFICULTY.startLevel;

  const [pool, ctx] = await Promise.all([loadApprovedPool(admin), playerContext(admin, userId)]);
  if (pool.length === 0) throw new HttpError(409, 'empty_bank', 'No approved scenarios are available yet.');

  let picked: PoolRow[];
  let plannedLength: number | null;
  const requestedIds = Array.isArray(body.scenarioIds) ? body.scenarioIds.filter(isUuid).slice(0, 20) : [];

  if (requestedIds.length > 0) {
    // Retry specific scenarios — only ones the player has already met in review.
    const byId = new Map(pool.map((p) => [p.id, p]));
    picked = requestedIds.filter((id) => ctx.allReviewIds.has(id)).map((id) => byId.get(id)).filter((p): p is PoolRow => Boolean(p));
    if (picked.length === 0) throw new HttpError(404, 'not_found', 'Those scenarios are not available for retry.');
    plannedLength = picked.length;
  } else if (definition.source === 'review') {
    picked = selectReviewScenarios({
      pool,
      missedIds: ctx.pendingReviewIds,
      count: definition.sessionLength ?? 10,
      targetDifficulty: startingDifficulty,
      excludeIds: new Set(),
      categoryWeakness: ctx.weakness,
      rng: Math.random,
    });
    plannedLength = picked.length;
  } else {
    plannedLength = definition.sessionLength;
    picked = selectScenarios(pool, {
      targetDifficulty: startingDifficulty,
      count: Math.min(SESSION.prefetchSize, plannedLength ?? SESSION.prefetchSize),
      excludeIds: new Set(),
      recentIds: ctx.recentIds,
      categoryWeakness: ctx.weakness,
      rng: Math.random,
    });
  }
  if (picked.length === 0 || plannedLength === 0) throw new HttpError(409, 'empty_bank', 'No scenarios are available for this mode yet.');

  const progress = createSessionProgress(mode, startingDifficulty);
  const { data: session, error } = await admin
    .from('game_sessions')
    .insert({
      user_id: userId,
      game_mode: mode,
      starting_difficulty: progress.startingDifficulty,
      current_difficulty: progress.difficulty,
      max_difficulty: progress.maxDifficulty,
      planned_length: plannedLength,
      served_scenario_ids: picked.map((p) => p.id),
    })
    .select('id')
    .single();
  if (error) throw new HttpError(500, 'db_error', error.message);

  return {
    sessionId: session.id as string,
    mode,
    plannedLength,
    progress,
    scenarios: await loadPublicScenarios(admin, picked.map((p) => p.id)),
  };
}

async function next(admin: SupabaseClient, userId: string, body: Record<string, unknown>) {
  const sessionId = requireUuid(body, 'sessionId');
  const requested = typeof body.count === 'number' ? Math.floor(body.count) : SESSION.prefetchSize;
  const session: SessionRow = await loadOwnSession(admin, sessionId, userId);
  if (session.session_status !== 'active') throw new HttpError(409, 'session_not_active', 'This session has ended.');

  const served = session.served_scenario_ids ?? [];
  const remaining = session.planned_length === null ? 10 : session.planned_length - served.length;
  const count = Math.max(0, Math.min(10, requested, remaining));
  if (count === 0) return { scenarios: [] };

  const [pool, ctx] = await Promise.all([loadApprovedPool(admin), playerContext(admin, userId)]);
  const byId = new Map(pool.map((p) => [p.id, p]));
  const lastServed = served.slice(-SESSION.maxSameAnswerRun).map((id) => byId.get(id)).filter((p): p is PoolRow => Boolean(p));
  const progress = rowToProgress(session);

  const picked = selectScenarios(pool, {
    targetDifficulty: progress.difficulty,
    count,
    excludeIds: new Set(served),
    recentIds: ctx.recentIds,
    categoryWeakness: ctx.weakness,
    previousAnswers: lastServed.map((p) => p.correctAnswer),
    previousCategoryId: lastServed[lastServed.length - 1]?.categoryId ?? null,
    rng: Math.random,
  });
  if (picked.length === 0) return { scenarios: [] };

  const { error } = await admin
    .from('game_sessions')
    .update({ served_scenario_ids: [...served, ...picked.map((p) => p.id)] })
    .eq('id', sessionId);
  if (error) throw new HttpError(500, 'db_error', error.message);

  return { scenarios: await loadPublicScenarios(admin, picked.map((p) => p.id)) };
}

serve(async (req) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const body = await readJson(req);
  if (body.action === 'start') return json(await start(admin, user.id, body));
  if (body.action === 'next') return json(await next(admin, user.id, body));
  throw new HttpError(400, 'invalid_request', 'action must be "start" or "next".');
});
