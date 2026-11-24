import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_CATEGORIES, SCENARIO_LIMITS, ethicalRatio, isNearDuplicate } from '@/core';
import { SEED_SCENARIOS } from '@/data/seed-scenarios';
import { validateEmail, validatePassword, validateUsername } from '@/features/auth/validation';
import { recommendedTopics, topicInsights, weakestTopics } from '@/features/analytics/insights';

describe('seed scenarios', () => {
  it('has at least 60 scenarios with unique ids', () => {
    expect(SEED_SCENARIOS.length).toBeGreaterThanOrEqual(60);
    expect(new Set(SEED_SCENARIOS.map((s) => s.id)).size).toBe(SEED_SCENARIOS.length);
  });

  it('covers every category and every difficulty tier', () => {
    const categories = new Set(SEED_SCENARIOS.map((s) => s.categoryId));
    for (const c of DEFAULT_CATEGORIES) expect(categories.has(c.id)).toBe(true);
    const difficulties = new Set(SEED_SCENARIOS.map((s) => s.difficulty));
    for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) expect(difficulties.has(d)).toBe(true);
  });

  it('keeps a reasonable ethical / unethical balance', () => {
    const ratio = ethicalRatio(SEED_SCENARIOS);
    expect(ratio).toBeGreaterThan(0.35);
    expect(ratio).toBeLessThan(0.65);
  });

  it('fits mobile cards and has complete explanations', () => {
    for (const s of SEED_SCENARIOS) {
      expect(s.text.length).toBeGreaterThanOrEqual(SCENARIO_LIMITS.scenarioMin);
      expect(s.text.length).toBeLessThanOrEqual(SCENARIO_LIMITS.scenarioMax);
      expect(s.explanation.length).toBeGreaterThan(30);
      expect(s.ethicalPrinciples.length).toBeGreaterThan(0);
      expect(s.status).toBe('approved');
    }
  });

  it('contains no near-duplicate scenarios', () => {
    for (let i = 0; i < SEED_SCENARIOS.length; i++) {
      for (let j = i + 1; j < SEED_SCENARIOS.length; j++) {
        expect(isNearDuplicate(SEED_SCENARIOS[i]!.text, SEED_SCENARIOS[j]!.text)).toBe(false);
      }
    }
  });
});

describe('edge function core copy', () => {
  it('matches src/core (run `npm run sync:core` if this fails)', () => {
    const root = join(__dirname, '..');
    const src = join(root, 'src/core');
    const dest = join(root, 'supabase/functions/_shared/core');
    const files = readdirSync(src).filter((f) => f.endsWith('.ts'));
    expect(readdirSync(dest).filter((f) => f.endsWith('.ts')).sort()).toEqual([...files].sort());
    for (const f of files) {
      const expected =
        '// GENERATED from src/core by `npm run sync:core`. Do not edit here.\n' +
        readFileSync(join(src, f), 'utf8').replace(/(from\s+'\.\/[A-Za-z0-9._-]+?)(?<!\.ts)'/g, "$1.ts'");
      expect(readFileSync(join(dest, f), 'utf8')).toBe(expected);
    }
  });
});

describe('learning insights', () => {
  it('does not label topics as mastered or weak on small samples', () => {
    const insights = topicInsights(DEFAULT_CATEGORIES, {
      'data-privacy': { correct: 3, incorrect: 0, lastPracticedAt: null },
      cybersecurity: { correct: 0, incorrect: 2, lastPracticedAt: null },
    });
    expect(insights.find((i) => i.category.id === 'data-privacy')?.mastered).toBe(false);
    expect(weakestTopics(insights)).toHaveLength(0);
  });

  it('marks mastery only with enough answers and high accuracy', () => {
    const [i] = topicInsights([DEFAULT_CATEGORIES[0]!], { 'data-privacy': { correct: 15, incorrect: 1, lastPracticedAt: null } });
    expect(i?.mastered).toBe(true);
  });

  it('recommends weak topics first, then unpractised ones', () => {
    const insights = topicInsights(DEFAULT_CATEGORIES, { cybersecurity: { correct: 1, incorrect: 5, lastPracticedAt: null } });
    expect(recommendedTopics(insights)[0]?.category.id).toBe('cybersecurity');
  });
});

describe('auth form validation', () => {
  it('validates email, password and username', () => {
    expect(validateEmail('a@b.co')).toBeNull();
    expect(validateEmail('nope')).not.toBeNull();
    expect(validatePassword('short1')).not.toBeNull();
    expect(validatePassword('longenough1')).toBeNull();
    expect(validatePassword('noNumbersHere')).not.toBeNull();
    expect(validateUsername('ethics_fan')).toBeNull();
    expect(validateUsername('a')).not.toBeNull();
    expect(validateUsername('bad name!')).not.toBeNull();
  });
});
