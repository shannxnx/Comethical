import type {
  Category,
  CategoryTally,
  DifficultyChange,
  EthicalAnswer,
  GameModeId,
  PublicScenario,
  ScenarioExplanation,
  SessionProgress,
} from '@/core/types';

export interface StartSessionOptions {
  /** Retry these specific (previously missed) scenarios. */
  scenarioIds?: string[];
}

export interface StartedSession {
  sessionId: string;
  mode: GameModeId;
  plannedLength: number | null;
  progress: SessionProgress;
  scenarios: PublicScenario[];
}

export interface AnswerSubmission {
  sessionId: string;
  scenarioId: string;
  selected: EthicalAnswer;
  responseMs: number;
}

export interface AnswerOutcome extends ScenarioExplanation {
  scenarioId: string;
  selected: EthicalAnswer;
  correct: boolean;
  pointsEarned: number;
  xpEarned: number;
  milestone: number | null;
  difficultyChange: DifficultyChange;
  progress: SessionProgress;
}

export interface ReviewItem {
  scenario: PublicScenario;
  explanation: ScenarioExplanation;
  selected: EthicalAnswer;
  timesMissed: number;
  lastMissedAt: number;
  reviewed: boolean;
  reviewedAt: number | null;
}

export interface SessionSummary {
  sessionId: string;
  mode: GameModeId;
  status: 'completed' | 'abandoned';
  progress: SessionProgress;
  completionXp: number;
  totalXpEarned: number;
  answered: number;
  accuracy: number;
  levelBefore: number;
  levelAfter: number;
  totalXp: number;
  isNewBestStreak: boolean;
  mistakes: ReviewItem[];
}

export interface SessionHistoryEntry {
  id: string;
  mode: GameModeId;
  score: number;
  correct: number;
  incorrect: number;
  bestStreak: number;
  xpEarned: number;
  endingDifficulty: number;
  completedAt: number;
  status: 'completed' | 'abandoned';
}

export interface TopicStat extends CategoryTally {
  lastPracticedAt: number | null;
}

export interface PlayerStats {
  username: string;
  totalXp: number;
  highestStreak: number;
  totalAnswered: number;
  totalCorrect: number;
  sessionsCompleted: number;
  currentDifficulty: number;
  topicStats: Record<string, TopicStat>;
  /** Most recent first. */
  recentSessions: SessionHistoryEntry[];
  bestScores: Partial<Record<GameModeId, number>>;
  bestStreaks: Partial<Record<GameModeId, number>>;
  pendingReviewCount: number;
}

export type ReportReason = 'incorrect_answer' | 'ambiguous' | 'unclear' | 'offensive' | 'other';

/** Data access boundary. Demo mode and Supabase implement the same contract. */
export interface GameRepository {
  readonly kind: 'demo' | 'online';
  getCategories(): Promise<Category[]>;
  startSession(mode: GameModeId, options?: StartSessionOptions): Promise<StartedSession>;
  nextScenarios(sessionId: string, count: number): Promise<PublicScenario[]>;
  submitAnswer(submission: AnswerSubmission): Promise<AnswerOutcome>;
  completeSession(sessionId: string, status: 'completed' | 'abandoned'): Promise<SessionSummary>;
  getPlayerStats(): Promise<PlayerStats>;
  getReviewItems(): Promise<ReviewItem[]>;
  markReviewed(scenarioId: string): Promise<void>;
  reportScenario(scenarioId: string, reason: ReportReason, description?: string): Promise<void>;
  updateUsername(username: string): Promise<void>;
  resetProgress?(): Promise<void>;
}

/** Error with a stable code the UI can map to a friendly message. */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable = false,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
