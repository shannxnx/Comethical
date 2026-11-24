// Answer submission: validates the answer server-side and records score, XP,
// streak, difficulty and learning stats atomically (public.record_answer).
import { HttpError, json, readJson, requireUuid, serve } from '../_shared/http.ts';
import { adminClient, requireUser } from '../_shared/supabase.ts';
import { loadOwnSession, rowToProgress } from '../_shared/game.ts';
import { GAME_MODES } from '../_shared/core/game.config.ts';
import { ADAPTIVE_DIFFICULTY } from '../_shared/core/difficulty.config.ts';
import { applyAnswer, isAnswerCorrect } from '../_shared/core/session.ts';
import { getLevelProgress } from '../_shared/core/scoring.ts';
import type { EthicalAnswer } from '../_shared/core/types.ts';

serve(async (req) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const body = await readJson(req);

  const sessionId = requireUuid(body, 'sessionId');
  const scenarioId = requireUuid(body, 'scenarioId');
  const selected = body.selected;
  if (selected !== 'ethical' && selected !== 'unethical') {
    throw new HttpError(400, 'invalid_request', 'selected must be "ethical" or "unethical".');
  }
  const responseMs = typeof body.responseMs === 'number' && Number.isFinite(body.responseMs) ? Math.round(body.responseMs) : 0;

  const session = await loadOwnSession(admin, sessionId, user.id);
  if (!(session.served_scenario_ids ?? []).includes(scenarioId)) {
    throw new HttpError(400, 'not_served', 'This scenario is not part of the session.');
  }

  const { data: scenario, error: scenarioError } = await admin
    .from('scenarios')
    .select('id, category_id, difficulty_score, correct_answer, explanation, ethical_principles, recommended_action, learning_objective')
    .eq('id', scenarioId)
    .single();
  if (scenarioError || !scenario) throw new HttpError(404, 'not_found', 'Scenario not found.');

  const reveal = {
    scenarioId,
    correctAnswer: scenario.correct_answer as EthicalAnswer,
    explanation: scenario.explanation as string,
    ethicalPrinciples: scenario.ethical_principles as string[],
    recommendedAction: scenario.recommended_action as string | null,
    learningObjective: scenario.learning_objective as string | null,
  };

  // Idempotency: a retried / duplicate submission returns the original result.
  const replay = async () => {
    const { data: existing } = await admin
      .from('user_answers')
      .select('selected_answer, is_correct, points_earned, xp_earned')
      .eq('session_id', sessionId)
      .eq('scenario_id', scenarioId)
      .maybeSingle();
    if (!existing) return null;
    const fresh = await loadOwnSession(admin, sessionId, user.id);
    return json({
      ...reveal,
      selected: existing.selected_answer,
      correct: existing.is_correct,
      pointsEarned: existing.points_earned,
      xpEarned: existing.xp_earned,
      milestone: null,
      difficultyChange: 0,
      progress: rowToProgress(fresh),
      duplicate: true,
    });
  };

  const replayed = await replay();
  if (replayed) return replayed;
  if (session.session_status !== 'active') throw new HttpError(409, 'session_not_active', 'This session has ended.');

  const mode = GAME_MODES[session.game_mode];
  const adaptiveModes = Object.values(GAME_MODES).filter((m) => m.adaptiveDifficulty).map((m) => m.id);
  const [{ data: recent, error: recentError }, { data: reviewItem }] = await Promise.all([
    admin
      .from('user_answers')
      .select('is_correct')
      .eq('user_id', user.id)
      .in('game_mode', adaptiveModes)
      .order('answered_at', { ascending: false })
      .limit(ADAPTIVE_DIFFICULTY.windowSize - 1),
    admin
      .from('user_review_items')
      .select('review_status')
      .eq('user_id', user.id)
      .eq('scenario_id', scenarioId)
      .maybeSingle(),
  ]);
  if (recentError) throw new HttpError(500, 'db_error', recentError.message);

  const correct = isAnswerCorrect(selected, reveal.correctAnswer);
  const progressBefore = rowToProgress(session);
  const result = applyAnswer(progressBefore, {
    correct,
    scenarioDifficulty: scenario.difficulty_score as number,
    categoryId: scenario.category_id as string,
    isReviewOfMistake: reviewItem?.review_status === 'pending',
    recentResults: [...(recent ?? []).map((r) => r.is_correct as boolean).reverse(), correct],
  });

  const { data: totals, error: rpcError } = await admin.rpc('record_answer', {
    p_user_id: user.id,
    p_session_id: sessionId,
    p_scenario_id: scenarioId,
    p_category_id: scenario.category_id,
    p_selected: selected,
    p_is_correct: correct,
    p_points: result.pointsEarned,
    p_xp: result.xpEarned,
    p_response_ms: responseMs,
    p_difficulty: scenario.difficulty_score,
    p_mode: session.game_mode,
    p_expected_answered: progressBefore.correct + progressBefore.incorrect,
    p_session: result.progress,
    p_adaptive: mode.adaptiveDifficulty,
    p_marks_reviewed: mode.marksReviewed,
  });
  if (rpcError) {
    if (rpcError.code === '23505') {
      const again = await replay();
      if (again) return again;
    }
    if (rpcError.message.includes('stale_session')) {
      throw new HttpError(409, 'stale_session', 'Another answer was recorded at the same time. Please retry.');
    }
    throw new HttpError(500, 'db_error', rpcError.message);
  }

  const totalXp = (Array.isArray(totals) ? totals[0]?.total_xp : totals?.total_xp) as number | undefined;
  if (typeof totalXp === 'number') {
    await admin.from('profiles').update({ player_level: getLevelProgress(totalXp).level }).eq('id', user.id);
  }

  return json({
    ...reveal,
    selected,
    correct,
    pointsEarned: result.pointsEarned,
    xpEarned: result.xpEarned,
    milestone: result.milestone,
    difficultyChange: result.difficultyChange,
    progress: result.progress,
  });
});
