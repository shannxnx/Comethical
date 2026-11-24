// GENERATED from src/core by `npm run sync:core`. Do not edit here.
import type { DifficultyTierId } from './types.ts';

export interface DifficultyTier {
  id: DifficultyTierId;
  label: string;
  min: number;
  max: number;
}

export const DIFFICULTY_TIERS: readonly DifficultyTier[] = [
  { id: 'beginner', label: 'Beginner', min: 1, max: 2 },
  { id: 'easy', label: 'Easy', min: 3, max: 4 },
  { id: 'intermediate', label: 'Intermediate', min: 5, max: 6 },
  { id: 'advanced', label: 'Advanced', min: 7, max: 8 },
  { id: 'expert', label: 'Expert', min: 9, max: 10 },
];

export interface AdaptiveDifficultyConfig {
  /** Level a brand-new player starts at. */
  startLevel: number;
  minLevel: number;
  maxLevel: number;
  /** How many recent answers are evaluated. */
  windowSize: number;
  /** Minimum answers in the window before any adjustment is considered. */
  minAnswersBeforeAdjust: number;
  /** Minimum answers between two adjustments. */
  cooldownAnswers: number;
  /** Accuracy (0..1) at or above which difficulty increases. */
  increaseAccuracy: number;
  /** Accuracy (0..1) below which difficulty decreases. */
  decreaseAccuracy: number;
  /** Levels moved per adjustment. Keep at 1 to avoid sudden spikes. */
  step: number;
  /** This many consecutive incorrect answers triggers an early decrease (still respects cooldown). */
  consecutiveIncorrectDrop: number;
}

export const ADAPTIVE_DIFFICULTY: AdaptiveDifficultyConfig = {
  startLevel: 2,
  minLevel: 1,
  maxLevel: 10,
  windowSize: 10,
  minAnswersBeforeAdjust: 5,
  cooldownAnswers: 4,
  increaseAccuracy: 0.8,
  decreaseAccuracy: 0.5,
  step: 1,
  consecutiveIncorrectDrop: 3,
};
