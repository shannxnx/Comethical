import type { ApprovalStatus, DifficultyFactors, DifficultyTierId, EthicalAnswer, GenerationSource } from '@/core';

export interface AdminScenario {
  id: string;
  categoryId: string;
  text: string;
  correctAnswer: EthicalAnswer;
  explanation: string;
  ethicalPrinciples: string[];
  recommendedAction: string | null;
  learningObjective: string | null;
  difficulty: number;
  difficultyReasoning: string;
  difficultyFactors: DifficultyFactors | null;
  status: ApprovalStatus;
  source: GenerationSource;
  reviewNotes: string | null;
  adminInstructions: string | null;
  timesAnswered: number;
  timesCorrect: number;
  createdAt: string;
  reviewedAt: string | null;
  /** Served to players only when approved AND inGame. */
  inGame: boolean;
}

export interface AdminStats {
  total: number;
  drafts: number;
  flagged: number;
  approved: number;
  rejected: number;
  /** Approved and switched on: what players actually get. */
  live: number;
  /** Approved but switched off. */
  hidden: number;
  /** Average difficulty of live scenarios. */
  averageDifficulty: number;
}

export type AdminSection = 'generate' | 'review' | 'library';
export type ReviewFilter = 'pending' | 'flagged' | 'rejected';
export type Visibility = 'all' | 'in_game' | 'hidden' | 'not_approved';

export interface LibraryFilters {
  search: string;
  categoryId: string | null;
  tierId: DifficultyTierId | null;
  source: 'ai' | 'seed' | null;
  visibility: Visibility;
}

export const DEFAULT_LIBRARY_FILTERS: LibraryFilters = { search: '', categoryId: null, tierId: null, source: null, visibility: 'all' };

export interface ListQuery {
  statuses?: ApprovalStatus[];
  search?: string;
  categoryId?: string;
  minDifficulty?: number;
  maxDifficulty?: number;
  source?: 'ai' | 'seed';
  inGame?: boolean;
  limit?: number;
  offset?: number;
}

export interface GenerateRequest {
  categoryId: string;
  difficultyMin: number;
  difficultyMax: number;
  count: number;
  instructions: string;
}

export interface GenerateResult {
  created: AdminScenario[];
  skippedInvalid: number;
  skippedDuplicates: number;
  message: string;
}

export interface ScenarioPatch {
  categoryId: string;
  text: string;
  correctAnswer: EthicalAnswer;
  explanation: string;
  ethicalPrinciples: string[];
  recommendedAction: string | null;
  learningObjective: string | null;
  difficulty: number;
  difficultyReasoning: string;
}

/** Admin-facing labels for the stored approval statuses. */
export const STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: 'Draft',
  flagged: 'Flagged',
  approved: 'Live',
  rejected: 'Rejected',
};
