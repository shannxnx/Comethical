import type { EthicalAnswer } from './types';

/**
 * Validation of AI (Gemini) output. AI responses are untrusted input:
 * everything is checked before it can be stored, and nothing generated is auto-approved
 * for scored play unless it also passes the separate assessment step.
 */

export interface AiScenario {
  scenario: string;
  category: string;
  correctAnswer: EthicalAnswer;
  explanation: string;
  ethicalPrinciples: string[];
  recommendedAction: string | null;
  difficultyScore: number;
  difficultyReasoning: string;
  learningObjective: string;
  /** Model's own flag that more than one answer is defensible. */
  ambiguous: boolean;
}

export interface AiAssessment {
  difficultyScore: number;
  difficultyReasoning: string;
  ambiguous: boolean;
  ambiguityReason: string | null;
  qualityIssues: string[];
  verdict: 'approve' | 'flag' | 'reject';
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export const SCENARIO_LIMITS = {
  scenarioMin: 25,
  scenarioMax: 320,
  explanationMin: 30,
  explanationMax: 700,
  principlesMin: 1,
  principlesMax: 5,
  principleMax: 60,
  textMax: 400,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cleanString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s.length > 0 ? s : null;
}

/** Extracts JSON from a model response that may be wrapped in a markdown code fence. */
export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const body = fence?.[1] ?? trimmed;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export function validateAiScenario(raw: unknown, allowedCategories: readonly string[]): ValidationResult<AiScenario> {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ['Scenario is not an object.'] };

  const scenario = cleanString(raw.scenario);
  if (!scenario) errors.push('scenario is required.');
  else if (scenario.length < SCENARIO_LIMITS.scenarioMin) errors.push('scenario is too short.');
  else if (scenario.length > SCENARIO_LIMITS.scenarioMax) errors.push('scenario is too long for a mobile card.');

  const categoryRaw = cleanString(raw.category);
  const category = allowedCategories.find((c) => c.toLowerCase() === categoryRaw?.toLowerCase()) ?? null;
  if (!category) errors.push(`category "${String(raw.category)}" is not an active category.`);

  const answerRaw = typeof raw.correctAnswer === 'string' ? raw.correctAnswer.trim().toLowerCase() : '';
  const correctAnswer: EthicalAnswer | null =
    answerRaw === 'ethical' || answerRaw === 'unethical' ? answerRaw : null;
  if (!correctAnswer) errors.push('correctAnswer must be "ethical" or "unethical".');

  const explanation = cleanString(raw.explanation);
  if (!explanation) errors.push('explanation is required.');
  else if (explanation.length < SCENARIO_LIMITS.explanationMin) errors.push('explanation is too short.');
  else if (explanation.length > SCENARIO_LIMITS.explanationMax) errors.push('explanation is too long.');

  const principles = Array.isArray(raw.ethicalPrinciples)
    ? raw.ethicalPrinciples.map(cleanString).filter((p): p is string => p !== null && p.length <= SCENARIO_LIMITS.principleMax)
    : [];
  const uniquePrinciples = [...new Set(principles)];
  if (uniquePrinciples.length < SCENARIO_LIMITS.principlesMin) errors.push('at least one ethical principle is required.');
  if (uniquePrinciples.length > SCENARIO_LIMITS.principlesMax) errors.push('too many ethical principles.');

  const recommendedAction = raw.recommendedAction == null ? null : cleanString(raw.recommendedAction);
  if (recommendedAction && recommendedAction.length > SCENARIO_LIMITS.textMax) errors.push('recommendedAction is too long.');

  const difficultyScore = typeof raw.difficultyScore === 'number' ? raw.difficultyScore : Number.NaN;
  if (!Number.isInteger(difficultyScore) || difficultyScore < 1 || difficultyScore > 10) {
    errors.push('difficultyScore must be an integer from 1 to 10.');
  }

  const difficultyReasoning = cleanString(raw.difficultyReasoning);
  if (!difficultyReasoning) errors.push('difficultyReasoning is required.');

  const learningObjective = cleanString(raw.learningObjective);
  if (!learningObjective) errors.push('learningObjective is required.');

  if (raw.ambiguous !== undefined && typeof raw.ambiguous !== 'boolean') errors.push('ambiguous must be a boolean.');

  // Explanations must not invent sources.
  const citationPattern = /\b(et al\.|doi:|https?:\/\/|\(\d{4}\))/i;
  if (explanation && citationPattern.test(explanation)) errors.push('explanation must not contain citations or links.');

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      scenario: scenario as string,
      category: category as string,
      correctAnswer: correctAnswer as EthicalAnswer,
      explanation: explanation as string,
      ethicalPrinciples: uniquePrinciples,
      recommendedAction,
      difficultyScore,
      difficultyReasoning: difficultyReasoning as string,
      learningObjective: learningObjective as string,
      ambiguous: raw.ambiguous === true,
    },
  };
}

/** Validates a `{ "scenarios": [...] }` batch, returning valid items and per-item errors. */
export function validateAiBatch(
  raw: unknown,
  allowedCategories: readonly string[],
): { valid: AiScenario[]; invalid: { index: number; errors: string[] }[]; structuralError: string | null } {
  const list = isRecord(raw) && Array.isArray(raw.scenarios) ? raw.scenarios : Array.isArray(raw) ? raw : null;
  if (!list) return { valid: [], invalid: [], structuralError: 'Response is not a scenario list.' };
  const valid: AiScenario[] = [];
  const invalid: { index: number; errors: string[] }[] = [];
  list.forEach((item, index) => {
    const result = validateAiScenario(item, allowedCategories);
    if (result.ok) valid.push(result.value);
    else invalid.push({ index, errors: result.errors });
  });
  return { valid, invalid, structuralError: null };
}

export function validateAiAssessment(raw: unknown): ValidationResult<AiAssessment> {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ['Assessment is not an object.'] };
  const difficultyScore = raw.difficultyScore;
  if (typeof difficultyScore !== 'number' || !Number.isInteger(difficultyScore) || difficultyScore < 1 || difficultyScore > 10) {
    errors.push('difficultyScore must be an integer from 1 to 10.');
  }
  const difficultyReasoning = cleanString(raw.difficultyReasoning);
  if (!difficultyReasoning) errors.push('difficultyReasoning is required.');
  if (typeof raw.ambiguous !== 'boolean') errors.push('ambiguous must be a boolean.');
  const verdict = raw.verdict;
  if (verdict !== 'approve' && verdict !== 'flag' && verdict !== 'reject') errors.push('verdict must be approve, flag or reject.');
  const qualityIssues = Array.isArray(raw.qualityIssues)
    ? raw.qualityIssues.map(cleanString).filter((s): s is string => s !== null)
    : [];
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      difficultyScore: difficultyScore as number,
      difficultyReasoning: difficultyReasoning as string,
      ambiguous: raw.ambiguous as boolean,
      ambiguityReason: cleanString(raw.ambiguityReason),
      qualityIssues,
      verdict: verdict as AiAssessment['verdict'],
    },
  };
}

/**
 * Final status for a scenario after assessment. Ambiguous scenarios are always flagged
 * for human review instead of being forced into a binary answer.
 */
export function decideApprovalStatus(
  assessment: AiAssessment,
  autoApprove: boolean,
): 'pending' | 'approved' | 'rejected' | 'flagged' {
  if (assessment.verdict === 'reject') return 'rejected';
  if (assessment.ambiguous || assessment.verdict === 'flag') return 'flagged';
  return autoApprove ? 'approved' : 'pending';
}

/** Ratio of ethical answers in a batch (0..1). */
export function ethicalRatio(items: readonly { correctAnswer: EthicalAnswer }[]): number {
  if (items.length === 0) return 0.5;
  return items.filter((i) => i.correctAnswer === 'ethical').length / items.length;
}
