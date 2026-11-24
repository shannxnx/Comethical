/**
 * Core domain types shared by the app and the Supabase Edge Functions.
 * This folder (src/core) must stay framework-free: no React, React Native, Expo or Deno imports,
 * and only relative imports of sibling files. `npm run sync:core` copies it into
 * supabase/functions/_shared/core so the server enforces exactly the same rules.
 */

export type EthicalAnswer = 'ethical' | 'unethical';
export type SwipeDirection = 'left' | 'right';

export type GameModeId = 'classic' | 'endless' | 'review';

export type DifficultyTierId = 'beginner' | 'easy' | 'intermediate' | 'advanced' | 'expert';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

export type GenerationSource = 'seed' | 'ai' | 'manual';

export interface Category {
  id: string;
  name: string;
  description: string;
  /** Ionicons glyph name. */
  icon: string;
  /** Hex color. */
  color: string;
  active: boolean;
}

/** A scenario as shown to the player before they answer. Never contains the answer. */
export interface PublicScenario {
  id: string;
  categoryId: string;
  text: string;
  difficulty: number;
}

/** Everything revealed after answering. */
export interface ScenarioExplanation {
  correctAnswer: EthicalAnswer;
  explanation: string;
  ethicalPrinciples: string[];
  recommendedAction: string | null;
  learningObjective: string | null;
}

/** Full scenario record (server-side / local seed bank). */
export interface Scenario extends PublicScenario, ScenarioExplanation {
  difficultyReasoning: string;
  source: GenerationSource;
  status: ApprovalStatus;
}

/** One answer in the player's history, used for adaptive difficulty and analytics. */
export interface AnswerRecord {
  scenarioId: string;
  categoryId: string;
  correct: boolean;
  difficulty: number;
  mode: GameModeId;
  answeredAt: number;
}

export interface CategoryTally {
  correct: number;
  incorrect: number;
}

/** In-session progress. Pure data so it can be computed identically on client and server. */
export interface SessionProgress {
  mode: GameModeId;
  score: number;
  correct: number;
  incorrect: number;
  streak: number;
  bestStreak: number;
  xpEarned: number;
  startingDifficulty: number;
  difficulty: number;
  maxDifficulty: number;
  /** Answers since the last difficulty adjustment (cooldown tracking). */
  answersSinceAdjustment: number;
  consecutiveIncorrect: number;
  categoryResults: Record<string, CategoryTally>;
}

export type DifficultyChange = -1 | 0 | 1;
