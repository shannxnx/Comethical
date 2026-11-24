import type { DifficultyTierId, GameModeId } from './types';

export interface StreakMultiplierBand {
  minStreak: number;
  multiplier: number;
}

export interface Rank {
  title: string;
  minLevel: number;
}

export interface ScoringConfig {
  basePoints: Record<DifficultyTierId, number>;
  /** Sorted ascending by minStreak. */
  streakMultipliers: readonly StreakMultiplierBand[];
  /** XP for a correct answer, by tier. */
  xpPerCorrect: Record<DifficultyTierId, number>;
  /** Extra XP for a correct answer on a previously missed scenario (Smart Review). */
  reviewCorrectBonusXp: number;
  /** XP for finishing a session, by mode. */
  sessionCompletionXp: Record<GameModeId, number>;
  /** Minimum answers before a session completion bonus is paid (stops farming empty sessions). */
  minAnswersForCompletionXp: number;
  streakMilestones: readonly number[];
  /** XP bonus when a streak milestone is reached. */
  streakMilestoneXp: Record<number, number>;
}

export const SCORING: ScoringConfig = {
  basePoints: {
    beginner: 100,
    easy: 125,
    intermediate: 150,
    advanced: 200,
    expert: 250,
  },
  streakMultipliers: [
    { minStreak: 0, multiplier: 1 },
    { minStreak: 5, multiplier: 1.25 },
    { minStreak: 10, multiplier: 1.5 },
    { minStreak: 20, multiplier: 2 },
    { minStreak: 30, multiplier: 3 },
  ],
  xpPerCorrect: {
    beginner: 10,
    easy: 12,
    intermediate: 15,
    advanced: 20,
    expert: 25,
  },
  reviewCorrectBonusXp: 10,
  sessionCompletionXp: {
    classic: 50,
    endless: 30,
    review: 40,
  },
  minAnswersForCompletionXp: 5,
  streakMilestones: [5, 10, 20, 30],
  streakMilestoneXp: { 5: 15, 10: 30, 20: 60, 30: 100 },
};

export interface LevelingConfig {
  /** XP needed to go from level 1 to level 2. */
  baseXp: number;
  /** Additional XP needed for each further level. */
  xpGrowthPerLevel: number;
  maxLevel: number;
  /** Sorted ascending by minLevel. */
  ranks: readonly Rank[];
}

export const LEVELING: LevelingConfig = {
  baseXp: 200,
  xpGrowthPerLevel: 75,
  maxLevel: 99,
  ranks: [
    { title: 'Digital Rookie', minLevel: 1 },
    { title: 'Ethical Explorer', minLevel: 4 },
    { title: 'Digital Guardian', minLevel: 8 },
    { title: 'Cyber Sentinel', minLevel: 13 },
    { title: 'Ethics Master', minLevel: 20 },
    { title: 'Ethical Legend', minLevel: 30 },
  ],
};
