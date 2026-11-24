// GENERATED from src/core by `npm run sync:core`. Do not edit here.
import { DIFFICULTY_TIERS, type DifficultyTier } from './difficulty.config.ts';
import { LEVELING, SCORING, type LevelingConfig, type Rank, type ScoringConfig } from './scoring.config.ts';
import type { DifficultyTierId, GameModeId } from './types.ts';

export function clampDifficulty(value: number, min = 1, max = 10): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function getDifficultyTier(difficulty: number): DifficultyTier {
  const d = clampDifficulty(difficulty);
  const tier = DIFFICULTY_TIERS.find((t) => d >= t.min && d <= t.max);
  // DIFFICULTY_TIERS covers 1..10 completely, so this fallback is unreachable in practice.
  return tier ?? (DIFFICULTY_TIERS[0] as DifficultyTier);
}

export function getTierId(difficulty: number): DifficultyTierId {
  return getDifficultyTier(difficulty).id;
}

/** Multiplier for the streak *including* the answer just given. */
export function getStreakMultiplier(streak: number, config: ScoringConfig = SCORING): number {
  let multiplier = 1;
  for (const band of config.streakMultipliers) {
    if (streak >= band.minStreak) multiplier = band.multiplier;
  }
  return multiplier;
}

/** Points for a correct answer. `streak` is the streak after this answer. */
export function calculatePoints(difficulty: number, streak: number, config: ScoringConfig = SCORING): number {
  const base = config.basePoints[getTierId(difficulty)];
  return Math.round(base * getStreakMultiplier(streak, config));
}

export interface AnswerXpInput {
  correct: boolean;
  difficulty: number;
  /** True when the scenario was a previously missed one, answered in Smart Review. */
  isReviewOfMistake: boolean;
  /** Streak after this answer. */
  streak: number;
}

export function calculateAnswerXp(input: AnswerXpInput, config: ScoringConfig = SCORING): number {
  if (!input.correct) return 0;
  let xp = config.xpPerCorrect[getTierId(input.difficulty)];
  if (input.isReviewOfMistake) xp += config.reviewCorrectBonusXp;
  const milestoneXp = config.streakMilestoneXp[input.streak];
  if (milestoneXp) xp += milestoneXp;
  return xp;
}

/** Returns the milestone value when `streak` exactly hits one, otherwise null. */
export function getStreakMilestone(streak: number, config: ScoringConfig = SCORING): number | null {
  return config.streakMilestones.includes(streak) ? streak : null;
}

export function calculateCompletionXp(
  mode: GameModeId,
  answered: number,
  config: ScoringConfig = SCORING,
): number {
  if (answered < config.minAnswersForCompletionXp) return 0;
  return config.sessionCompletionXp[mode];
}

// ---------------------------------------------------------------------------
// Levels and ranks
// ---------------------------------------------------------------------------

/** XP required to advance from `level` to `level + 1`. */
export function xpForNextLevel(level: number, config: LevelingConfig = LEVELING): number {
  return config.baseXp + config.xpGrowthPerLevel * (Math.max(1, level) - 1);
}

/** Total XP needed to *reach* `level` from level 1. */
export function totalXpForLevel(level: number, config: LevelingConfig = LEVELING): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForNextLevel(l, config);
  return total;
}

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  xpIntoLevel: number;
  /** XP the current level requires in total. */
  xpForLevel: number;
  /** 0..1 */
  progress: number;
  rank: Rank;
  nextRank: Rank | null;
}

export function getRankForLevel(level: number, config: LevelingConfig = LEVELING): Rank {
  let rank = config.ranks[0] as Rank;
  for (const r of config.ranks) if (level >= r.minLevel) rank = r;
  return rank;
}

export function getLevelProgress(totalXp: number, config: LevelingConfig = LEVELING): LevelProgress {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (level < config.maxLevel && remaining >= xpForNextLevel(level, config)) {
    remaining -= xpForNextLevel(level, config);
    level += 1;
  }
  const xpForLevel = xpForNextLevel(level, config);
  const atMax = level >= config.maxLevel;
  const rank = getRankForLevel(level, config);
  const nextRank = config.ranks.find((r) => r.minLevel > level) ?? null;
  return {
    level,
    xpIntoLevel: atMax ? xpForLevel : remaining,
    xpForLevel,
    progress: atMax ? 1 : remaining / xpForLevel,
    rank,
    nextRank,
  };
}
