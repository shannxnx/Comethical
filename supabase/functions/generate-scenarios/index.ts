// Admin: generate a batch of scenarios with Gemini, validate, dedupe, store as "pending",
// then run the independent assessment (difficulty + ambiguity + quality).
// Nothing generated reaches scored play unless it ends up "approved".
//
// POST { "count": 10, "categories": ["Data Privacy"], "difficultyMin": 1, "difficultyMax": 10 }
// Header: x-admin-key: <ADMIN_API_KEY>
import { HttpError, json, readJson, serve } from '../_shared/http.ts';
import { adminClient, requireAdmin } from '../_shared/supabase.ts';
import { generateJson, geminiModel } from '../_shared/gemini.ts';
import { GENERATION_SYSTEM, SCENARIO_BATCH_SCHEMA, generationPrompt } from '../_shared/prompts.ts';
import { ethicalRatio, validateAiBatch } from '../_shared/core/scenario-validation.ts';
import { dedupeAgainst } from '../_shared/core/similarity.ts';
import { enforceAiRateLimit, logGeneration } from '../_shared/game.ts';
import { assessAndStore, loadScenariosForAssessment } from '../_shared/assessment.ts';

const MAX_BATCH = 15;

serve(async (req) => {
  requireAdmin(req);
  const admin = adminClient();
  const body = await readJson(req);
  await enforceAiRateLimit(admin);

  const count = Math.min(MAX_BATCH, Math.max(1, Math.floor(Number(body.count ?? 10))));
  const difficultyMin = Math.min(10, Math.max(1, Math.floor(Number(body.difficultyMin ?? 1))));
  const difficultyMax = Math.min(10, Math.max(difficultyMin, Math.floor(Number(body.difficultyMax ?? 10))));
  const skipAssessment = body.skipAssessment === true;

  const { data: categories, error: catError } = await admin.from('categories').select('id, name').eq('active', true);
  if (catError) throw new HttpError(500, 'db_error', catError.message);
  const requested = Array.isArray(body.categories) ? body.categories.filter((c): c is string => typeof c === 'string') : [];
  const active = (categories ?? []).filter((c) => requested.length === 0 || requested.some((r) => r.toLowerCase() === c.name.toLowerCase()));
  if (active.length === 0) throw new HttpError(400, 'invalid_request', 'No matching active categories.');

  // Existing texts for duplicate detection (and a sample to steer the model away from repeats).
  const { data: existingRows, error: existingError } = await admin
    .from('scenarios')
    .select('scenario_text')
    .neq('approval_status', 'rejected')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (existingError) throw new HttpError(500, 'db_error', existingError.message);
  const existing = (existingRows ?? []).map((r) => r.scenario_text as string);

  const started = Date.now();
  const model = geminiModel();
  let raw: unknown;
  try {
    raw = await generateJson({
      system: GENERATION_SYSTEM,
      prompt: generationPrompt({
        count,
        categories: active.map((c) => c.name),
        difficultyMin,
        difficultyMax,
        avoidExamples: existing.slice(0, 25),
      }),
      schema: SCENARIO_BATCH_SCHEMA,
      temperature: 0.9,
    });
  } catch (error) {
    await logGeneration(admin, {
      model, operation: 'generate', requested: count, generated: 0, accepted: 0, status: 'failed',
      errors: { message: error instanceof Error ? error.message : String(error) }, durationMs: Date.now() - started,
    });
    throw error;
  }

  const { valid, invalid, structuralError } = validateAiBatch(raw, active.map((c) => c.name));
  const ambiguous = valid.filter((v) => v.ambiguous);
  const { unique, duplicates } = dedupeAgainst(valid, existing, (v) => v.scenario);

  const nameToId = new Map(active.map((c) => [c.name.toLowerCase(), c.id as string]));
  const rows = unique.map((v) => ({
    category_id: nameToId.get(v.category.toLowerCase()),
    scenario_text: v.scenario,
    correct_answer: v.correctAnswer,
    explanation: v.explanation,
    ethical_principles: v.ethicalPrinciples,
    recommended_action: v.recommendedAction,
    difficulty_score: v.difficultyScore,
    difficulty_reasoning: v.difficultyReasoning,
    learning_objective: v.learningObjective,
    generation_source: 'ai',
    // Self-reported ambiguity is flagged immediately; everything else waits for assessment.
    approval_status: v.ambiguous ? 'flagged' : 'pending',
    review_notes: v.ambiguous ? 'Generator marked as ambiguous.' : null,
    ai_model: model,
  }));

  let insertedIds: string[] = [];
  if (rows.length > 0) {
    const { data: inserted, error } = await admin.from('scenarios').insert(rows).select('id, approval_status');
    if (error) throw new HttpError(500, 'db_error', error.message);
    insertedIds = (inserted ?? []).filter((r) => r.approval_status === 'pending').map((r) => r.id as string);
  }

  const assessment = skipAssessment || insertedIds.length === 0
    ? []
    : await assessAndStore(admin, await loadScenariosForAssessment(admin, { ids: insertedIds, limit: insertedIds.length }), 'validate', model);

  const status = structuralError ? 'failed' : invalid.length > 0 || duplicates.length > 0 ? 'partial' : 'success';
  await logGeneration(admin, {
    model,
    operation: 'generate',
    requested: count,
    generated: valid.length + invalid.length,
    accepted: rows.length,
    status,
    errors: { structuralError, invalid, duplicates: duplicates.length, ambiguous: ambiguous.length },
    durationMs: Date.now() - started,
  });

  return json({
    requested: count,
    received: valid.length + invalid.length,
    stored: rows.length,
    invalid,
    duplicatesSkipped: duplicates.length,
    flaggedAmbiguous: ambiguous.length,
    ethicalRatio: ethicalRatio(unique),
    assessment,
  });
});
