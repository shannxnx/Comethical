// GENERATED from src/core by `npm run sync:core`. Do not edit here.
import { ADAPTIVE_DIFFICULTY, type AdaptiveDifficultyConfig } from './difficulty.config.ts';
import type { DifficultyChange } from './types.ts';

export interface DifficultyInput {
  currentLevel: number;
  /** Most recent answers, oldest first. Only the last `windowSize` are used. */
  recentResults: readonly boolean[];
  /** Answers since the last adjustment (including the latest one). */
  answersSinceAdjustment: number;
  consecutiveIncorrect: number;
}

export interface DifficultyDecision {
  level: number;
  change: DifficultyChange;
  accuracy: number | null;
  reason: 'insufficient-data' | 'cooldown' | 'increase' | 'decrease' | 'hold' | 'at-limit' | 'struggling';
}

export function clampLevel(level: number, config: AdaptiveDifficultyConfig = ADAPTIVE_DIFFICULTY): number {
  if (!Number.isFinite(level)) return config.startLevel;
  return Math.min(config.maxLevel, Math.max(config.minLevel, Math.round(level)));
}

export function windowAccuracy(results: readonly boolean[], windowSize: number): number | null {
  const window = results.slice(-windowSize);
  if (window.length === 0) return null;
  return window.filter(Boolean).length / window.length;
}

/**
 * Deterministic adaptive difficulty engine.
 * - Holds until `minAnswersBeforeAdjust` answers are in the window.
 * - Respects a cooldown between adjustments.
 * - Moves at most `step` levels at a time, clamped to [minLevel, maxLevel].
 */
export function evaluateDifficulty(
  input: DifficultyInput,
  config: AdaptiveDifficultyConfig = ADAPTIVE_DIFFICULTY,
): DifficultyDecision {
  const level = clampLevel(input.currentLevel, config);
  const window = input.recentResults.slice(-config.windowSize);
  const accuracy = windowAccuracy(window, config.windowSize);

  if (input.answersSinceAdjustment < config.cooldownAnswers) {
    return { level, change: 0, accuracy, reason: 'cooldown' };
  }

  // Early relief when the player is clearly stuck, even before the window fills up.
  if (input.consecutiveIncorrect >= config.consecutiveIncorrectDrop) {
    const next = clampLevel(level - config.step, config);
    return next === level
      ? { level, change: 0, accuracy, reason: 'at-limit' }
      : { level: next, change: -1, accuracy, reason: 'struggling' };
  }

  if (window.length < config.minAnswersBeforeAdjust || accuracy === null) {
    return { level, change: 0, accuracy, reason: 'insufficient-data' };
  }

  if (accuracy >= config.increaseAccuracy) {
    const next = clampLevel(level + config.step, config);
    return next === level
      ? { level, change: 0, accuracy, reason: 'at-limit' }
      : { level: next, change: 1, accuracy, reason: 'increase' };
  }

  if (accuracy < config.decreaseAccuracy) {
    const next = clampLevel(level - config.step, config);
    return next === level
      ? { level, change: 0, accuracy, reason: 'at-limit' }
      : { level: next, change: -1, accuracy, reason: 'decrease' };
  }

  return { level, change: 0, accuracy, reason: 'hold' };
}
