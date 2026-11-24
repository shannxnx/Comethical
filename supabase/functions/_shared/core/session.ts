// GENERATED from src/core by `npm run sync:core`. Do not edit here.
import { evaluateDifficulty, clampLevel } from './difficulty.ts';
import { ADAPTIVE_DIFFICULTY, type AdaptiveDifficultyConfig } from './difficulty.config.ts';
import { GAME_MODES } from './game.config.ts';
import { calculateAnswerXp, calculateCompletionXp, calculatePoints, getStreakMilestone } from './scoring.ts';
import { SCORING, type ScoringConfig } from './scoring.config.ts';
import type { DifficultyChange, EthicalAnswer, GameModeId, SessionProgress } from './types.ts';

export function createSessionProgress(mode: GameModeId, startingDifficulty: number): SessionProgress {
  const start = clampLevel(startingDifficulty);
  return {
    mode,
    score: 0,
    correct: 0,
    incorrect: 0,
    streak: 0,
    bestStreak: 0,
    xpEarned: 0,
    startingDifficulty: start,
    difficulty: start,
    maxDifficulty: start,
    answersSinceAdjustment: 0,
    consecutiveIncorrect: 0,
    categoryResults: {},
  };
}

export function isAnswerCorrect(selected: EthicalAnswer, correctAnswer: EthicalAnswer): boolean {
  return selected === correctAnswer;
}

export interface ApplyAnswerInput {
  correct: boolean;
  scenarioDifficulty: number;
  categoryId: string;
  /** True when this scenario was previously missed and is answered in a review-type mode. */
  isReviewOfMistake: boolean;
  /**
   * The player's recent results (oldest first) INCLUDING this answer.
   * Spans sessions so difficulty carries over between games.
   */
  recentResults: readonly boolean[];
}

export interface ApplyAnswerResult {
  progress: SessionProgress;
  pointsEarned: number;
  xpEarned: number;
  milestone: number | null;
  difficultyChange: DifficultyChange;
}

/**
 * Pure session reducer: given the current progress and one answer, returns the next progress
 * plus everything the UI needs for feedback. Used by local demo mode AND the submit-answer
 * Edge Function, so client and server can never disagree on scoring rules.
 */
export function applyAnswer(
  progress: SessionProgress,
  input: ApplyAnswerInput,
  scoring: ScoringConfig = SCORING,
  adaptive: AdaptiveDifficultyConfig = ADAPTIVE_DIFFICULTY,
): ApplyAnswerResult {
  const mode = GAME_MODES[progress.mode];
  const streak = input.correct ? progress.streak + 1 : 0;
  const pointsEarned = input.correct ? calculatePoints(input.scenarioDifficulty, streak, scoring) : 0;
  const milestone = input.correct ? getStreakMilestone(streak, scoring) : null;
  const xpEarned = calculateAnswerXp(
    {
      correct: input.correct,
      difficulty: input.scenarioDifficulty,
      isReviewOfMistake: input.isReviewOfMistake && mode.marksReviewed,
      streak,
    },
    scoring,
  );

  const previousTally = progress.categoryResults[input.categoryId] ?? { correct: 0, incorrect: 0 };
  const categoryResults = {
    ...progress.categoryResults,
    [input.categoryId]: {
      correct: previousTally.correct + (input.correct ? 1 : 0),
      incorrect: previousTally.incorrect + (input.correct ? 0 : 1),
    },
  };

  const consecutiveIncorrect = input.correct ? 0 : progress.consecutiveIncorrect + 1;
  let difficulty = progress.difficulty;
  let answersSinceAdjustment = progress.answersSinceAdjustment + 1;
  let difficultyChange: DifficultyChange = 0;

  if (mode.adaptiveDifficulty) {
    const decision = evaluateDifficulty(
      {
        currentLevel: progress.difficulty,
        recentResults: input.recentResults,
        answersSinceAdjustment,
        consecutiveIncorrect,
      },
      adaptive,
    );
    if (decision.change !== 0) {
      difficulty = decision.level;
      difficultyChange = decision.change;
      answersSinceAdjustment = 0;
    }
  }

  return {
    progress: {
      ...progress,
      score: progress.score + pointsEarned,
      correct: progress.correct + (input.correct ? 1 : 0),
      incorrect: progress.incorrect + (input.correct ? 0 : 1),
      streak,
      bestStreak: Math.max(progress.bestStreak, streak),
      xpEarned: progress.xpEarned + xpEarned,
      difficulty,
      maxDifficulty: Math.max(progress.maxDifficulty, difficulty),
      answersSinceAdjustment,
      consecutiveIncorrect,
      categoryResults,
    },
    pointsEarned,
    xpEarned,
    milestone,
    difficultyChange,
  };
}

export function answeredCount(progress: SessionProgress): number {
  return progress.correct + progress.incorrect;
}

export function accuracyOf(correct: number, total: number): number {
  return total > 0 ? correct / total : 0;
}

/** True once a fixed-length mode has served all its cards. */
export function isSessionComplete(progress: SessionProgress, plannedLength: number | null): boolean {
  if (plannedLength === null) return false;
  return answeredCount(progress) >= plannedLength;
}

export interface CompletionResult {
  progress: SessionProgress;
  completionXp: number;
  totalXp: number;
}

export function completeSessionProgress(progress: SessionProgress, scoring: ScoringConfig = SCORING): CompletionResult {
  const completionXp = calculateCompletionXp(progress.mode, answeredCount(progress), scoring);
  const xpEarned = progress.xpEarned + completionXp;
  return { progress: { ...progress, xpEarned }, completionXp, totalXp: xpEarned };
}
