import { categoryWeakness, mulberry32, selectReviewScenarios, selectScenarios, type SelectionCandidate } from '@/core';

function pool(n: number): Required<SelectionCandidate>[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    categoryId: `c${i % 4}`,
    difficulty: (i % 10) + 1,
    correctAnswer: i % 3 === 0 ? 'ethical' : 'unethical',
  }));
}

describe('selectScenarios', () => {
  it('never repeats scenarios already served in the session', () => {
    const p = pool(30);
    const exclude = new Set(['s0', 's1', 's2', 's3']);
    const picked = selectScenarios(p, { targetDifficulty: 2, count: 10, excludeIds: exclude, rng: mulberry32(1) });
    expect(picked).toHaveLength(10);
    expect(picked.some((s) => exclude.has(s.id))).toBe(false);
    expect(new Set(picked.map((s) => s.id)).size).toBe(10);
  });

  it('prefers scenarios near the target difficulty', () => {
    const picked = selectScenarios(pool(100), { targetDifficulty: 8, count: 5, excludeIds: new Set(), rng: mulberry32(2) });
    for (const s of picked) expect(Math.abs(s.difficulty - 8)).toBeLessThanOrEqual(2);
  });

  it('avoids recently answered scenarios when alternatives exist', () => {
    const p = pool(40);
    const recent = new Set(p.filter((s) => s.difficulty === 5).slice(0, 2).map((s) => s.id));
    const picked = selectScenarios(p, { targetDifficulty: 5, count: 2, excludeIds: new Set(), recentIds: recent, rng: mulberry32(3) });
    expect(picked.some((s) => recent.has(s.id))).toBe(false);
  });

  it('prevents long runs of the same correct answer', () => {
    const p = pool(60);
    const picked = selectScenarios(p, { targetDifficulty: 5, count: 20, excludeIds: new Set(), rng: mulberry32(4) });
    let run = 1;
    for (let i = 1; i < picked.length; i++) {
      run = picked[i]?.correctAnswer === picked[i - 1]?.correctAnswer ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(3);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = selectScenarios(pool(50), { targetDifficulty: 4, count: 8, excludeIds: new Set(), rng: mulberry32(9) });
    const b = selectScenarios(pool(50), { targetDifficulty: 4, count: 8, excludeIds: new Set(), rng: mulberry32(9) });
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
  });

  it('returns what it can from a small or empty bank', () => {
    expect(selectScenarios([], { targetDifficulty: 2, count: 5, excludeIds: new Set(), rng: Math.random })).toEqual([]);
    expect(selectScenarios(pool(3), { targetDifficulty: 2, count: 5, excludeIds: new Set(), rng: Math.random })).toHaveLength(3);
  });
});

describe('categoryWeakness', () => {
  it('ignores categories without enough answers', () => {
    const w = categoryWeakness({ a: { correct: 1, incorrect: 1 }, b: { correct: 2, incorrect: 6 } }, 4);
    expect(w.a).toBeUndefined();
    expect(w.b).toBeCloseTo(0.75);
  });
});

describe('selectReviewScenarios', () => {
  it('serves missed scenarios first, in priority order', () => {
    const p = pool(30);
    const picked = selectReviewScenarios({
      pool: p,
      missedIds: ['s7', 's3', 's11'],
      count: 5,
      targetDifficulty: 3,
      excludeIds: new Set(),
      categoryWeakness: {},
      rng: mulberry32(5),
    });
    expect(picked.slice(0, 3).map((s) => s.id)).toEqual(['s7', 's3', 's11']);
    expect(picked).toHaveLength(5);
  });

  it('fills remaining slots from weak categories', () => {
    const p = pool(40);
    const picked = selectReviewScenarios({
      pool: p,
      missedIds: [],
      count: 4,
      targetDifficulty: 5,
      excludeIds: new Set(),
      categoryWeakness: { c2: 0.8 },
      rng: mulberry32(6),
    });
    expect(picked.every((s) => s.categoryId === 'c2')).toBe(true);
  });
});
