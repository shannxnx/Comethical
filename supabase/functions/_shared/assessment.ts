import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { generateJson } from './gemini.ts';
import { ASSESSMENT_SCHEMA, ASSESSMENT_SYSTEM, assessmentPrompt } from './prompts.ts';
import { decideApprovalStatus, validateAiAssessment, type AiAssessment } from './core/scenario-validation.ts';
import { HttpError } from './http.ts';

export interface ScenarioForAssessment {
  id: string;
  scenario_text: string;
  correct_answer: string;
  explanation: string;
  ethical_principles: string[];
  category_name: string;
}

export async function loadScenariosForAssessment(
  admin: SupabaseClient,
  filter: { ids?: string[]; status?: string; limit: number },
): Promise<ScenarioForAssessment[]> {
  let query = admin
    .from('scenarios')
    .select('id, scenario_text, correct_answer, explanation, ethical_principles, categories(name)')
    .limit(filter.limit);
  if (filter.ids && filter.ids.length > 0) query = query.in('id', filter.ids);
  else if (filter.status) query = query.eq('approval_status', filter.status);
  const { data, error } = await query;
  if (error) throw new HttpError(500, 'db_error', error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    scenario_text: r.scenario_text as string,
    correct_answer: r.correct_answer as string,
    explanation: r.explanation as string,
    ethical_principles: r.ethical_principles as string[],
    category_name: ((r.categories as { name?: string } | null)?.name ?? 'Unknown') as string,
  }));
}

/** Independent AI review of one scenario (difficulty + ambiguity + quality). */
export async function assessScenario(s: ScenarioForAssessment): Promise<AiAssessment> {
  const raw = await generateJson({
    system: ASSESSMENT_SYSTEM,
    prompt: assessmentPrompt({
      text: s.scenario_text,
      category: s.category_name,
      correctAnswer: s.correct_answer,
      explanation: s.explanation,
      principles: s.ethical_principles,
    }),
    schema: ASSESSMENT_SCHEMA,
    temperature: 0.2,
  });
  const result = validateAiAssessment(raw);
  if (!result.ok) throw new HttpError(502, 'ai_invalid', `Invalid assessment: ${result.errors.join(' ')}`);
  return result.value;
}

export interface AssessmentOutcome {
  id: string;
  ok: boolean;
  status?: string;
  difficulty?: number;
  error?: string;
}

/**
 * Runs the assessment for each scenario.
 * mode "difficulty": only updates the difficulty score + reasoning.
 * mode "validate": also sets approval status (ambiguous → flagged, wrong → rejected).
 */
export async function assessAndStore(
  admin: SupabaseClient,
  scenarios: ScenarioForAssessment[],
  mode: 'difficulty' | 'validate',
  model: string,
): Promise<AssessmentOutcome[]> {
  const autoApprove = (Deno.env.get('AUTO_APPROVE_VALIDATED') ?? 'false').toLowerCase() === 'true';
  const outcomes: AssessmentOutcome[] = [];
  for (const s of scenarios) {
    try {
      const a = await assessScenario(s);
      const update: Record<string, unknown> = {
        difficulty_score: a.difficultyScore,
        difficulty_reasoning: a.difficultyReasoning,
        ai_model: model,
      };
      if (mode === 'validate') {
        const status = decideApprovalStatus(a, autoApprove);
        update.approval_status = status;
        update.review_notes = [a.ambiguityReason, ...a.qualityIssues].filter(Boolean).join(' | ') || null;
      }
      const { error } = await admin.from('scenarios').update(update).eq('id', s.id);
      if (error) throw new Error(error.message);
      outcomes.push({ id: s.id, ok: true, status: update.approval_status as string | undefined, difficulty: a.difficultyScore });
    } catch (error) {
      outcomes.push({ id: s.id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return outcomes;
}
