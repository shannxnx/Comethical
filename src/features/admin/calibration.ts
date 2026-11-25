import { clampDifficulty } from '@/core';

/** Answers needed before player accuracy says anything about a scenario's difficulty. */
export const CALIBRATION_MIN_ANSWERS = 10;
/** How far observed accuracy may drift from the expectation before we flag it (0..1). */
export const CALIBRATION_TOLERANCE = 0.2;

/** Rough accuracy players should reach at a given difficulty: 1 → 95 %, 10 → 41 %. */
export function expectedAccuracy(difficulty: number): number {
  return 0.95 - (clampDifficulty(difficulty) - 1) * 0.06;
}

export type CalibrationKind = 'insufficient' | 'ok' | 'easier' | 'harder';

export interface Calibration {
  kind: CalibrationKind;
  observed: number | null;
  expected: number;
}

/** Compares real player accuracy with the AI difficulty rating. */
export function calibrate(s: { difficulty: number; timesAnswered: number; timesCorrect: number }): Calibration {
  const expected = expectedAccuracy(s.difficulty);
  if (s.timesAnswered < CALIBRATION_MIN_ANSWERS) {
    return { kind: 'insufficient', observed: s.timesAnswered > 0 ? s.timesCorrect / s.timesAnswered : null, expected };
  }
  const observed = s.timesCorrect / s.timesAnswered;
  const diff = observed - expected;
  return { kind: diff > CALIBRATION_TOLERANCE ? 'easier' : diff < -CALIBRATION_TOLERANCE ? 'harder' : 'ok', observed, expected };
}
