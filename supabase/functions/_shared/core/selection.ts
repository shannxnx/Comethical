// GENERATED from src/core by `npm run sync:core`. Do not edit here.
import { SESSION, type SessionConfig } from './game.config.ts';
import type { CategoryTally, EthicalAnswer } from './types.ts';

export type Rng = () => number;

/** Small deterministic PRNG for reproducible selection in tests. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SelectionCandidate {
  id: string;
  categoryId: string;
  difficulty: number;
  /** Known server-side / in the local bank; used only to avoid predictable answer runs. */
  correctAnswer?: EthicalAnswer;
}

export interface SelectionContext {
  targetDifficulty: number;
  count: number;
  /** Already served in this session — never repeated. */
  excludeIds: ReadonlySet<string>;
  /** Answered recently in earlier sessions — avoided when alternatives exist. */
  recentIds?: ReadonlySet<string>;
  /** 0..1 per category; higher = weaker = more likely to be picked. */
  categoryWeakness?: Readonly<Record<string, number>>;
  /** Correct answers of the most recently served cards, oldest first. */
  previousAnswers?: readonly EthicalAnswer[];
  previousCategoryId?: string | null;
  rng: Rng;
}

const WEIGHTS = {
  difficultyDistance: 1,
  recentPenalty: 4,
  weaknessBonus: 1.5,
  sameCategoryPenalty: 0.8,
  jitter: 1.2,
};

function trailingRun(answers: readonly EthicalAnswer[]): { answer: EthicalAnswer | null; length: number } {
  const last = answers[answers.length - 1];
  if (!last) return { answer: null, length: 0 };
  let length = 0;
  for (let i = answers.length - 1; i >= 0 && answers[i] === last; i--) length++;
  return { answer: last, length };
}

/**
 * Picks `count` scenarios closest to the target difficulty while
 * - never repeating scenarios served this session,
 * - avoiding recently answered scenarios,
 * - favouring weak categories and category variety,
 * - preventing long runs of the same correct answer (no predictable patterns).
 */
export function selectScenarios<T extends SelectionCandidate>(
  pool: readonly T[],
  ctx: SelectionContext,
  config: SessionConfig = SESSION,
): T[] {
  const available = pool.filter((s) => !ctx.excludeIds.has(s.id));
  // Pre-compute a jittered base cost once so the order is stable within a call.
  const base = new Map<string, number>();
  for (const s of available) {
    let cost = Math.abs(s.difficulty - ctx.targetDifficulty) * WEIGHTS.difficultyDistance;
    if (ctx.recentIds?.has(s.id)) cost += WEIGHTS.recentPenalty;
    cost -= (ctx.categoryWeakness?.[s.categoryId] ?? 0) * WEIGHTS.weaknessBonus;
    cost += ctx.rng() * WEIGHTS.jitter;
    base.set(s.id, cost);
  }

  const picked: T[] = [];
  const pickedIds = new Set<string>();
  const answers: EthicalAnswer[] = [...(ctx.previousAnswers ?? [])];
  let lastCategory = ctx.previousCategoryId ?? null;

  while (picked.length < ctx.count) {
    const run = trailingRun(answers);
    let best: T | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const s of available) {
      if (pickedIds.has(s.id)) continue;
      let cost = base.get(s.id) ?? 0;
      if (lastCategory && s.categoryId === lastCategory) cost += WEIGHTS.sameCategoryPenalty;
      if (s.correctAnswer && run.answer === s.correctAnswer && run.length >= config.maxSameAnswerRun) {
        cost += 1000; // effectively forbidden unless nothing else is left
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = s;
      }
    }
    if (!best) break;
    picked.push(best);
    pickedIds.add(best.id);
    if (best.correctAnswer) answers.push(best.correctAnswer);
    lastCategory = best.categoryId;
  }
  return picked;
}

/** Converts per-category tallies into 0..1 weakness scores (needs a minimum sample). */
export function categoryWeakness(
  tallies: Readonly<Record<string, CategoryTally>>,
  minAnswers: number = SESSION.minAnswersForTopicInsight,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [categoryId, t] of Object.entries(tallies)) {
    const total = t.correct + t.incorrect;
    if (total < minAnswers) continue;
    result[categoryId] = t.incorrect / total;
  }
  return result;
}

export interface ReviewSelectionInput<T extends SelectionCandidate> {
  pool: readonly T[];
  /** Missed, not-yet-reviewed scenario ids, highest priority first. */
  missedIds: readonly string[];
  count: number;
  targetDifficulty: number;
  excludeIds: ReadonlySet<string>;
  categoryWeakness: Readonly<Record<string, number>>;
  rng: Rng;
}

/**
 * Smart Review: previously missed scenarios first, then practice from weak categories.
 */
export function selectReviewScenarios<T extends SelectionCandidate>(input: ReviewSelectionInput<T>): T[] {
  const byId = new Map(input.pool.map((s) => [s.id, s] as const));
  const missed: T[] = [];
  for (const id of input.missedIds) {
    if (missed.length >= input.count) break;
    if (input.excludeIds.has(id)) continue;
    const s = byId.get(id);
    if (s) missed.push(s);
  }
  if (missed.length >= input.count) return missed;

  const exclude = new Set([...input.excludeIds, ...missed.map((s) => s.id)]);
  const weakCategories = new Set(
    Object.entries(input.categoryWeakness)
      .filter(([, w]) => w > 0)
      .map(([id]) => id),
  );
  const weakPool = weakCategories.size > 0 ? input.pool.filter((s) => weakCategories.has(s.categoryId)) : input.pool;
  const fillFrom = weakPool.filter((s) => !exclude.has(s.id)).length > 0 ? weakPool : input.pool;

  const filler = selectScenarios(fillFrom, {
    targetDifficulty: input.targetDifficulty,
    count: input.count - missed.length,
    excludeIds: exclude,
    categoryWeakness: input.categoryWeakness,
    rng: input.rng,
  });
  return [...missed, ...filler];
}
