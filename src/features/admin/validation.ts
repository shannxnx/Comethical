import { SCENARIO_LIMITS } from '@/core';
import type { ScenarioPatch } from './types';

/** Client-side checks mirroring the server's validateAiScenario limits (the server re-validates). */
export function validateScenarioForm(p: ScenarioPatch): Record<string, string> {
  const e: Record<string, string> = {};
  if (p.text.length < SCENARIO_LIMITS.scenarioMin) e.text = `At least ${SCENARIO_LIMITS.scenarioMin} characters.`;
  else if (p.text.length > SCENARIO_LIMITS.scenarioMax) e.text = `At most ${SCENARIO_LIMITS.scenarioMax} characters so it fits on a card.`;
  if (p.explanation.length < SCENARIO_LIMITS.explanationMin) e.explanation = `At least ${SCENARIO_LIMITS.explanationMin} characters.`;
  if (/\b(et al\.|doi:|https?:\/\/)/i.test(p.explanation)) e.explanation = 'Remove links or citations.';
  if (p.ethicalPrinciples.length < SCENARIO_LIMITS.principlesMin || p.ethicalPrinciples.length > SCENARIO_LIMITS.principlesMax) {
    e.principles = 'List 1 to 5 principles, separated by commas.';
  }
  if (!p.learningObjective) e.objective = 'Add a learning objective.';
  if (!Number.isInteger(p.difficulty) || p.difficulty < 1 || p.difficulty > 10) e.difficulty = 'Difficulty must be 1–10.';
  return e;
}
