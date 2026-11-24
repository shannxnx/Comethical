import type { GameModeId } from './types';

/**
 * Game mode registry. New modes (Survival, Time Attack, Topic Mastery, Daily Challenge…)
 * are added here; the session engine and gameplay screen read behaviour from this table
 * instead of branching on mode ids.
 */
export interface GameModeDefinition {
  id: GameModeId;
  title: string;
  tagline: string;
  description: string;
  icon: string;
  /** null = unlimited (player ends the session). */
  sessionLength: number | null;
  adaptiveDifficulty: boolean;
  /** Seconds per card; null = no timer. Reserved for Time Attack. */
  timeLimitSeconds: number | null;
  /** Lives before game over; null = unlimited. Reserved for Survival. */
  lives: number | null;
  /** Where scenarios come from. */
  source: 'adaptive' | 'review';
  /** Correct answers on previously missed scenarios mark them as reviewed. */
  marksReviewed: boolean;
}

export const GAME_MODES: Record<GameModeId, GameModeDefinition> = {
  classic: {
    id: 'classic',
    title: 'Classic',
    tagline: '20 scenarios · adaptive',
    description: 'Twenty scenarios that adapt to how you play. No timer — take your time to think.',
    icon: 'layers',
    sessionLength: 20,
    adaptiveDifficulty: true,
    timeLimitSeconds: null,
    lives: null,
    source: 'adaptive',
    marksReviewed: false,
  },
  endless: {
    id: 'endless',
    title: 'Endless',
    tagline: 'Keep going · beat your best',
    description: 'Play as long as you like. Difficulty keeps adapting. Chase your longest streak.',
    icon: 'infinite',
    sessionLength: null,
    adaptiveDifficulty: true,
    timeLimitSeconds: null,
    lives: null,
    source: 'adaptive',
    marksReviewed: false,
  },
  review: {
    id: 'review',
    title: 'Smart Review',
    tagline: 'Fix past mistakes',
    description: 'Revisit scenarios you missed and practise your weakest topics.',
    icon: 'refresh-circle',
    sessionLength: 10,
    adaptiveDifficulty: false,
    timeLimitSeconds: null,
    lives: null,
    source: 'review',
    marksReviewed: true,
  },
};

export const GAME_MODE_ORDER: readonly GameModeId[] = ['classic', 'endless', 'review'];

export function isGameModeId(value: unknown): value is GameModeId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(GAME_MODES, value);
}

export interface SwipeConfig {
  /** Fraction of the card container width that must be crossed to commit a swipe. */
  thresholdRatio: number;
  /** A fast fling commits even below the distance threshold (points / second). */
  velocityThreshold: number;
  /** Minimum distance for a fling to count, so taps never commit. */
  minFlingDistance: number;
  /** Max card rotation in degrees at the threshold. */
  maxRotationDeg: number;
}

export const SWIPE: SwipeConfig = {
  thresholdRatio: 0.3,
  velocityThreshold: 900,
  minFlingDistance: 40,
  maxRotationDeg: 12,
};

export interface SessionConfig {
  /** How many upcoming cards to keep queued (prefetch). */
  prefetchSize: number;
  /** Refill the queue when it drops to this many cards. */
  refillWhen: number;
  /** Delay after a correct answer before the next card (ms). */
  correctFeedbackMs: number;
  /** Scenarios answered within this many most recent answers are avoided when possible. */
  recentAvoidWindow: number;
  /** Do not serve more than this many cards in a row with the same correct answer when avoidable. */
  maxSameAnswerRun: number;
  /** Minimum answers in a category before it can be called a strength / weakness. */
  minAnswersForTopicInsight: number;
  /** Minimum answers and accuracy before a topic is labelled mastered. */
  masteryMinAnswers: number;
  masteryAccuracy: number;
}

export const SESSION: SessionConfig = {
  prefetchSize: 4,
  refillWhen: 2,
  correctFeedbackMs: 650,
  recentAvoidWindow: 60,
  maxSameAnswerRun: 3,
  minAnswersForTopicInsight: 4,
  masteryMinAnswers: 15,
  masteryAccuracy: 0.85,
};
