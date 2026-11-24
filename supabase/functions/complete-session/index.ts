// Session completion: awards completion XP once and returns the summary (idempotent).
import { HttpError, json, readJson, requireUuid, serve } from '../_shared/http.ts';
import { adminClient, requireUser } from '../_shared/supabase.ts';
import { loadOwnSession, rowToProgress } from '../_shared/game.ts';
import { completeSessionProgress } from '../_shared/core/session.ts';
import { getLevelProgress } from '../_shared/core/scoring.ts';

serve(async (req) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const body = await readJson(req);
  const sessionId = requireUuid(body, 'sessionId');
  const status = body.status === 'abandoned' ? 'abandoned' : 'completed';

  const { data: profileBefore, error: profileError } = await admin
    .from('profiles')
    .select('total_xp, highest_streak')
    .eq('id', user.id)
    .single();
  if (profileError) throw new HttpError(500, 'db_error', profileError.message);

  let session = await loadOwnSession(admin, sessionId, user.id);
  let completionXp = 0;
  let totalXp = profileBefore.total_xp as number;

  if (session.session_status === 'active') {
    const progress = rowToProgress(session);
    completionXp = status === 'completed' ? completeSessionProgress(progress).completionXp : 0;
    const { data, error } = await admin.rpc('complete_session', {
      p_user_id: user.id,
      p_session_id: sessionId,
      p_status: status,
      p_completion_xp: completionXp,
    });
    if (error && !error.message.includes('session_not_active')) throw new HttpError(500, 'db_error', error.message);
    const newTotal = (Array.isArray(data) ? data[0]?.total_xp : data?.total_xp) as number | undefined;
    if (typeof newTotal === 'number') {
      totalXp = newTotal;
      await admin.from('profiles').update({ player_level: getLevelProgress(totalXp).level }).eq('id', user.id);
    }
    session = await loadOwnSession(admin, sessionId, user.id);
  }

  const { data: mistakes, error: mistakesError } = await admin
    .from('user_answers')
    .select('selected_answer, answered_at, scenarios(id, category_id, scenario_text, difficulty_score, correct_answer, explanation, ethical_principles, recommended_action, learning_objective)')
    .eq('session_id', sessionId)
    .eq('is_correct', false)
    .order('answered_at', { ascending: true });
  if (mistakesError) throw new HttpError(500, 'db_error', mistakesError.message);

  const progress = rowToProgress(session);
  const answered = progress.correct + progress.incorrect;

  return json({
    sessionId,
    mode: session.game_mode,
    status: session.session_status === 'active' ? status : session.session_status,
    progress,
    completionXp,
    totalXpEarned: progress.xpEarned,
    answered,
    accuracy: answered > 0 ? progress.correct / answered : 0,
    // Answer XP is added to the profile as it is earned, so "before" = total minus this session's XP.
    levelBefore: getLevelProgress(Math.max(0, totalXp - progress.xpEarned)).level,
    levelAfter: getLevelProgress(totalXp).level,
    totalXp,
    isNewBestStreak: progress.bestStreak > 0 && progress.bestStreak >= (profileBefore.highest_streak as number),
    mistakes: (mistakes ?? []).map((m: Record<string, unknown>) => {
      const s = m.scenarios as Record<string, unknown>;
      return {
        scenario: { id: s.id, categoryId: s.category_id, text: s.scenario_text, difficulty: s.difficulty_score },
        explanation: {
          correctAnswer: s.correct_answer,
          explanation: s.explanation,
          ethicalPrinciples: s.ethical_principles,
          recommendedAction: s.recommended_action,
          learningObjective: s.learning_objective,
        },
        selected: m.selected_answer,
        timesMissed: 1,
        lastMissedAt: Date.parse(m.answered_at as string),
        reviewed: false,
        reviewedAt: null,
      };
    }),
  });
});
