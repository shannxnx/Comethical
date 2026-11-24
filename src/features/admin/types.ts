import type { ApprovalStatus, DifficultyFactors, EthicalAnswer, GenerationSource } from '@/core';

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
}

export interface AdminStats {
  total: number;
  drafts: number;
  flagged: number;
  approved: number;
  rejected: number;
  averageDifficulty: number;
}

export type AdminFilter = 'pending' | 'flagged' | 'approved' | 'rejected' | 'all';

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
