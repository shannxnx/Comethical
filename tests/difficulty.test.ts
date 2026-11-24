import { ADAPTIVE_DIFFICULTY, clampLevel, evaluateDifficulty, windowAccuracy } from '@/core';

const results = (pattern: string) => [...pattern].map((c) => c === '1');

describe('adaptive difficulty engine', () => {
  const base = { currentLevel: 5, answersSinceAdjustment: 10, consecutiveIncorrect: 0 };

  it('starts new players at level 2', () => {
    expect(ADAPTIVE_DIFFICULTY.startLevel).toBe(2);
  });

  it('holds until the minimum number of answers is reached', () => {
    const d = evaluateDifficulty({ ...base, recentResults: results('1111') });
    expect(d).toMatchObject({ change: 0, reason: 'insufficient-data' });
  });

  it('increases one level at ≥ 80% accuracy', () => {
    const d = evaluateDifficulty({ ...base, recentResults: results('1111111100') });
    expect(d).toMatchObject({ level: 6, change: 1, reason: 'increase' });
  });

  it('holds between 50% and 79%', () => {
    expect(evaluateDifficulty({ ...base, recentResults: results('1111111000') }).change).toBe(0);
    expect(evaluateDifficulty({ ...base, recentResults: results('1111100000') }).change).toBe(0);
  });

  it('decreases one level below 50%', () => {
    const d = evaluateDifficulty({ ...base, recentResults: results('1100000010') });
    expect(d).toMatchObject({ level: 4, change: -1, reason: 'decrease' });
  });

  it('uses only the last windowSize answers', () => {
    const old = results('0000000000');
    const recent = results('1111111111');
    const d = evaluateDifficulty({ ...base, recentResults: [...old, ...recent] });
    expect(d.accuracy).toBe(1);
    expect(d.change).toBe(1);
  });

  it('respects the cooldown between adjustments', () => {
    const d = evaluateDifficulty({ ...base, answersSinceAdjustment: ADAPTIVE_DIFFICULTY.cooldownAnswers - 1, recentResults: results('1111111111') });
    expect(d).toMatchObject({ change: 0, reason: 'cooldown' });
  });

  it('eases difficulty after consecutive incorrect answers', () => {
    const d = evaluateDifficulty({ ...base, consecutiveIncorrect: ADAPTIVE_DIFFICULTY.consecutiveIncorrectDrop, recentResults: results('100') });
    expect(d).toMatchObject({ level: 4, change: -1, reason: 'struggling' });
  });

  it('never goes below the minimum', () => {
    const d = evaluateDifficulty({ ...base, currentLevel: 1, recentResults: results('0000000000') });
    expect(d).toMatchObject({ level: 1, change: 0, reason: 'at-limit' });
  });

  it('never exceeds the maximum', () => {
    const d = evaluateDifficulty({ ...base, currentLevel: 10, recentResults: results('1111111111') });
    expect(d).toMatchObject({ level: 10, change: 0, reason: 'at-limit' });
  });

  it('only ever moves by one step (no spikes)', () => {
    for (let level = 1; level <= 10; level++) {
      const up = evaluateDifficulty({ ...base, currentLevel: level, recentResults: results('1111111111') });
      const down = evaluateDifficulty({ ...base, currentLevel: level, recentResults: results('0000000000') });
      expect(Math.abs(up.level - level)).toBeLessThanOrEqual(1);
      expect(Math.abs(down.level - level)).toBeLessThanOrEqual(1);
    }
  });

  it('is configurable', () => {
    const config = { ...ADAPTIVE_DIFFICULTY, increaseAccuracy: 0.6, minAnswersBeforeAdjust: 3 };
    const d = evaluateDifficulty({ ...base, recentResults: results('110') }, config);
    expect(d.change).toBe(1);
  });

  it('clamps arbitrary levels', () => {
    expect(clampLevel(-3)).toBe(1);
    expect(clampLevel(99)).toBe(10);
    expect(clampLevel(Number.NaN)).toBe(ADAPTIVE_DIFFICULTY.startLevel);
    expect(windowAccuracy([], 10)).toBeNull();
  });
});
