// Admin console API (signed-in users with profiles.role = 'admin').
// Actions: list · generate (Gemini, from the admin's idea) · update · reassess · set-status · delete · export
// AI output is never approved automatically: new scenarios arrive as drafts (pending) or flagged.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { HttpError, isUuid, json, readJson, requireUuid, serve } from '../_shared/http.ts';
import { adminClient, requireAdminUser } from '../_shared/supabase.ts';
import { generateJson, geminiModel } from '../_shared/gemini.ts';
import { SCENARIO_BATCH_SCHEMA, GENERATION_SYSTEM, adminGenerationPrompt } from '../_shared/prompts.ts';
import { assessAndStore, loadScenariosForAssessment } from '../_shared/assessment.ts';
import { logGeneration } from '../_shared/game.ts';
import { validateAiBatch, validateAiScenario } from '../_shared/core/scenario-validation.ts';
import { dedupeAgainst } from '../_shared/core/similarity.ts';

const STATUSES = ['pending', 'approved', 'rejected', 'flagged'] as const;
type Status = (typeof STATUSES)[number];
const MAX_PER_GENERATION = 5;

const COLUMNS =
  'id, category_id, scenario_text, correct_answer, explanation, ethical_principles, recommended_action, learning_objective, ' +
  'difficulty_score, difficulty_reasoning, difficulty_factors, approval_status, generation_source, review_notes, ' +
  'admin_instructions, times_answered, times_correct, created_at, reviewed_at';

function toAdminScenario(r: Record<string, unknown>) {
  return {
    id: r.id,
    categoryId: r.category_id,
    text: r.scenario_text,
    correctAnswer: r.correct_answer,
    explanation: r.explanation,
    ethicalPrinciples: r.ethical_principles,
    recommendedAction: r.recommended_action,
    learningObjective: r.learning_objective,
    difficulty: r.difficulty_score,
    difficultyReasoning: r.difficulty_reasoning,
    difficultyFactors: r.difficulty_factors ?? null,
    status: r.approval_status,
    source: r.generation_source,
    reviewNotes: r.review_notes,
    adminInstructions: r.admin_instructions,
    timesAnswered: r.times_answered,
    timesCorrect: r.times_correct,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
  };
}

async function loadByIds(admin: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await admin.from('scenarios').select(COLUMNS).in('id', ids).order('created_at', { ascending: false });
  if (error) throw new HttpError(500, 'db_error', error.message);
  return (data ?? []).map((r) => toAdminScenario(r as unknown as Record<string, unknown>));
}

async function categoryName(admin: SupabaseClient, categoryId: unknown): Promise<{ id: string; name: string }> {
  if (typeof categoryId !== 'string') throw new HttpError(400, 'invalid_request', 'categoryId is required.');
  const { data, error } = await admin.from('categories').select('id, name').eq('id', categoryId).maybeSingle();
  if (error) throw new HttpError(500, 'db_error', error.message);
  if (!data) throw new HttpError(400, 'invalid_request', 'Unknown category.');
  return data as { id: string; name: string };
}

// ── actions ─────────────────────────────────────────────────────────────────

async function list(admin: SupabaseClient, body: Record<string, unknown>) {
  const status = typeof body.status === 'string' && (STATUSES as readonly string[]).includes(body.status) ? body.status : null;
  const limit = Math.min(100, Math.max(1, Math.floor(Number(body.limit ?? 50))));
  const offset = Math.max(0, Math.floor(Number(body.offset ?? 0)));

  let query = admin.from('scenarios').select(COLUMNS).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (status) query = query.eq('approval_status', status);
  const [{ data, error }, all] = await Promise.all([query, admin.from('scenarios').select('approval_status, difficulty_score').limit(10000)]);
  if (error) throw new HttpError(500, 'db_error', error.message);
  if (all.error) throw new HttpError(500, 'db_error', all.error.message);

  const rows = all.data ?? [];
  const count = (s: Status) => rows.filter((r) => r.approval_status === s).length;
  const avg = rows.length ? rows.reduce((sum, r) => sum + (r.difficulty_score as number), 0) / rows.length : 0;
  return {
    scenarios: (data ?? []).map((r) => toAdminScenario(r as unknown as Record<string, unknown>)),
    stats: {
      total: rows.length,
      drafts: count('pending'),
      flagged: count('flagged'),
      approved: count('approved'),
      rejected: count('rejected'),
      averageDifficulty: Math.round(avg * 10) / 10,
    },
  };
}

async function generate(admin: SupabaseClient, userId: string, body: Record<string, unknown>) {
  const category = await categoryName(admin, body.categoryId);
  const count = Math.min(MAX_PER_GENERATION, Math.max(1, Math.floor(Number(body.count ?? 3))));
  const difficultyMin = Math.min(10, Math.max(1, Math.floor(Number(body.difficultyMin ?? 3))));
  const difficultyMax = Math.min(10, Math.max(difficultyMin, Math.floor(Number(body.difficultyMax ?? difficultyMin + 1))));
  const instructions = typeof body.instructions === 'string' ? body.instructions.trim().slice(0, 1000) : '';

  // Per-admin hourly budget.
  const limit = Number(Deno.env.get('ADMIN_GENERATION_HOURLY_LIMIT') ?? '20');
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count: used } = await admin
    .from('ai_generation_logs')
    .select('id', { count: 'exact', head: true })
    .eq('requested_by', userId)
    .eq('operation', 'generate')
    .gte('created_at', since);
  if ((used ?? 0) >= limit) throw new HttpError(429, 'rate_limited', `Generation limit of ${limit} per hour reached. Try again later.`);

  const { data: existingRows } = await admin
    .from('scenarios')
    .select('scenario_text, category_id')
    .neq('approval_status', 'rejected')
    .order('created_at', { ascending: false })
    .limit(2000);
  const existing = (existingRows ?? []).map((r) => r.scenario_text as string);
  const sameCategory = (existingRows ?? []).filter((r) => r.category_id === category.id).map((r) => r.scenario_text as string);

  const model = geminiModel();
  const started = Date.now();
  let raw: unknown;
  try {
    raw = await generateJson({
      system: GENERATION_SYSTEM,
      prompt: adminGenerationPrompt({ count, category: category.name, difficultyMin, difficultyMax, instructions, avoidExamples: sameCategory.slice(0, 30) }),
      schema: SCENARIO_BATCH_SCHEMA,
      temperature: 0.9,
      budgetMs: 70_000,
    });
  } catch (error) {
    await admin.from('ai_generation_logs').insert({
      model_identifier: model, operation: 'generate', requested_count: count, generated_count: 0, accepted_count: 0,
      validation_status: 'failed', error_details: { message: error instanceof Error ? error.message : String(error) },
      duration_ms: Date.now() - started, requested_by: userId,
    });
    throw error;
  }

  const { valid, invalid, structuralError } = validateAiBatch(raw, [category.name]);
  const { unique, duplicates } = dedupeAgainst(valid, existing, (v) => v.scenario);
  const rows = unique.map((v) => ({
    category_id: category.id,
    scenario_text: v.scenario,
    correct_answer: v.correctAnswer,
    explanation: v.explanation,
    ethical_principles: v.ethicalPrinciples,
    recommended_action: v.recommendedAction,
    difficulty_score: v.difficultyScore,
    difficulty_reasoning: v.difficultyReasoning,
    learning_objective: v.learningObjective,
    generation_source: 'ai',
    approval_status: v.ambiguous ? 'flagged' : 'pending',
    review_notes: v.ambiguous ? 'Generator marked this as ambiguous.' : null,
    ai_model: model,
    admin_instructions: instructions || null,
    created_by: userId,
  }));

  let ids: string[] = [];
  if (rows.length > 0) {
    const { data, error } = await admin.from('scenarios').insert(rows).select('id');
    if (error) throw new HttpError(500, 'db_error', error.message);
    ids = (data ?? []).map((r) => r.id as string);
    // Independent AI review: difficulty factors + ambiguity/quality → pending / flagged / rejected.
    await assessAndStore(admin, await loadScenariosForAssessment(admin, { ids, limit: ids.length }), 'validate', model);
  }

  await logGeneration(admin, {
    model,
    operation: 'generate',
    requested: count,
    generated: valid.length + invalid.length,
    accepted: rows.length,
    status: structuralError || rows.length === 0 ? 'failed' : invalid.length || duplicates.length ? 'partial' : 'success',
    errors: { structuralError, invalid, duplicates: duplicates.length },
    durationMs: Date.now() - started,
    requestedBy: userId,
  });

  return {
    created: await loadByIds(admin, ids),
    skippedInvalid: invalid.length,
    skippedDuplicates: duplicates.length,
    message:
      rows.length === 0
        ? 'Gemini did not return any usable new scenarios. Try rephrasing the idea.'
        : `Created ${rows.length} draft scenario${rows.length > 1 ? 's' : ''}. Review and approve to publish.`,
  };
}

async function update(admin: SupabaseClient, userId: string, body: Record<string, unknown>) {
  const id = requireUuid(body, 'id');
  const patch = (body.patch ?? {}) as Record<string, unknown>;
  const category = await categoryName(admin, patch.categoryId);
  const checked = validateAiScenario(
    {
      scenario: patch.text,
      category: category.name,
      correctAnswer: patch.correctAnswer,
      explanation: patch.explanation,
      ethicalPrinciples: patch.ethicalPrinciples,
      recommendedAction: patch.recommendedAction || null,
      difficultyScore: patch.difficulty,
      difficultyReasoning: typeof patch.difficultyReasoning === 'string' && patch.difficultyReasoning.trim() ? patch.difficultyReasoning : 'Set by an administrator.',
      learningObjective: patch.learningObjective,
    },
    [category.name],
  );
  if (!checked.ok) throw new HttpError(400, 'invalid_scenario', checked.errors.join(' '));
  const v = checked.value;
  const fields: Record<string, unknown> = {
    category_id: category.id,
    scenario_text: v.scenario,
    correct_answer: v.correctAnswer,
    explanation: v.explanation,
    ethical_principles: v.ethicalPrinciples,
    recommended_action: v.recommendedAction,
    difficulty_score: v.difficultyScore,
    difficulty_reasoning: v.difficultyReasoning,
    learning_objective: v.learningObjective,
  };
  if (body.approve === true) Object.assign(fields, { approval_status: 'approved', reviewed_by: userId, reviewed_at: new Date().toISOString() });
  const { error } = await admin.from('scenarios').update(fields).eq('id', id);
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'duplicate', 'Another scenario already has this exact text.');
    throw new HttpError(500, 'db_error', error.message);
  }
  return { scenario: (await loadByIds(admin, [id]))[0] ?? null };
}

async function reassess(admin: SupabaseClient, body: Record<string, unknown>) {
  const id = requireUuid(body, 'id');
  const items = await loadScenariosForAssessment(admin, { ids: [id], limit: 1 });
  if (items.length === 0) throw new HttpError(404, 'not_found', 'Scenario not found.');
  const [outcome] = await assessAndStore(admin, items, 'difficulty', geminiModel());
  if (!outcome?.ok) throw new HttpError(502, 'ai_error', outcome?.error ?? 'Assessment failed.');
  return { scenario: (await loadByIds(admin, [id]))[0] ?? null };
}

async function setStatus(admin: SupabaseClient, userId: string, body: Record<string, unknown>) {
  const ids = Array.isArray(body.ids) ? body.ids.filter(isUuid).slice(0, 100) : [];
  const status = body.status;
  if (ids.length === 0) throw new HttpError(400, 'invalid_request', 'ids is required.');
  if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
    throw new HttpError(400, 'invalid_request', 'status must be approved, rejected or pending.');
  }
  const { error } = await admin
    .from('scenarios')
    .update({ approval_status: status, reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw new HttpError(500, 'db_error', error.message);
  return { scenarios: await loadByIds(admin, ids) };
}

async function remove(admin: SupabaseClient, body: Record<string, unknown>) {
  const id = requireUuid(body, 'id');
  const { data, error } = await admin.from('scenarios').select('times_answered').eq('id', id).maybeSingle();
  if (error) throw new HttpError(500, 'db_error', error.message);
  if (!data) return { deleted: false };
  if ((data.times_answered as number) > 0) {
    throw new HttpError(409, 'in_use', 'Players have already answered this scenario. Reject it instead so their history is kept.');
  }
  const { error: delError } = await admin.from('scenarios').delete().eq('id', id);
  if (delError) throw new HttpError(500, 'db_error', delError.message);
  return { deleted: true };
}

async function exportApproved(admin: SupabaseClient) {
  const { data, error } = await admin
    .from('scenarios')
    .select('scenario_text, correct_answer, explanation, ethical_principles, recommended_action, difficulty_score, difficulty_reasoning, learning_objective, categories(name)')
    .eq('approval_status', 'approved')
    .order('created_at', { ascending: true })
    .limit(5000);
  if (error) throw new HttpError(500, 'db_error', error.message);
  return {
    scenarios: (data ?? []).map((r: Record<string, unknown>) => ({
      scenario: r.scenario_text,
      category: (r.categories as { name?: string } | null)?.name ?? null,
      correctAnswer: r.correct_answer,
      explanation: r.explanation,
      ethicalPrinciples: r.ethical_principles,
      recommendedAction: r.recommended_action,
      difficultyScore: r.difficulty_score,
      difficultyReasoning: r.difficulty_reasoning,
      learningObjective: r.learning_objective,
    })),
  };
}

serve(async (req) => {
  const admin = adminClient();
  const user = await requireAdminUser(req, admin);
  const body = await readJson(req);
  switch (body.action) {
    case 'list':
      return json(await list(admin, body));
    case 'generate':
      return json(await generate(admin, user.id, body));
    case 'update':
      return json(await update(admin, user.id, body));
    case 'reassess':
      return json(await reassess(admin, body));
    case 'set-status':
      return json(await setStatus(admin, user.id, body));
    case 'delete':
      return json(await remove(admin, body));
    case 'export':
      return json(await exportApproved(admin));
    default:
      throw new HttpError(400, 'invalid_request', 'Unknown action.');
  }
});
