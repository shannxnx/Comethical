import { SESSION, type Category } from '@/core';
import type { PlayerStats, SessionHistoryEntry, TopicStat } from '@/types/game';

export interface TopicInsight {
  category: Category;
  answered: number;
  correct: number;
  accuracy: number | null;
  /** Enough answers to say anything about this topic. */
  reliable: boolean;
  mastered: boolean;
}

export function topicInsights(categories: readonly Category[], stats: Readonly<Record<string, TopicStat>>): TopicInsight[] {
  return categories.map((category) => {
    const t = stats[category.id];
    const answered = t ? t.correct + t.incorrect : 0;
    const accuracy = answered > 0 ? (t?.correct ?? 0) / answered : null;
    const reliable = answered >= SESSION.minAnswersForTopicInsight;
    return {
      category,
      answered,
      correct: t?.correct ?? 0,
      accuracy,
      reliable,
      // Never call a topic mastered on a small sample.
      mastered: answered >= SESSION.masteryMinAnswers && (accuracy ?? 0) >= SESSION.masteryAccuracy,
    };
  });
}

export function strongestTopics(insights: TopicInsight[], limit = 3): TopicInsight[] {
  return insights
    .filter((i) => i.reliable && (i.accuracy ?? 0) >= 0.6)
    .sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0) || b.answered - a.answered)
    .slice(0, limit);
}

export function weakestTopics(insights: TopicInsight[], limit = 3): TopicInsight[] {
  return insights
    .filter((i) => i.reliable && (i.accuracy ?? 1) < 0.75)
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0) || b.answered - a.answered)
    .slice(0, limit);
}

/** Weak topics first, then topics with too little practice to judge. */
export function recommendedTopics(insights: TopicInsight[], limit = 3): TopicInsight[] {
  const weak = weakestTopics(insights, limit);
  const picked = new Set(weak.map((w) => w.category.id));
  const unpracticed = insights
    .filter((i) => !i.reliable && !picked.has(i.category.id))
    .sort((a, b) => a.answered - b.answered);
  return [...weak, ...unpracticed].slice(0, limit);
}

export interface TrendPoint {
  id: string;
  accuracy: number;
  answered: number;
  completedAt: number;
}

/** Oldest → newest accuracy per session, for the improvement chart. */
export function accuracyTrend(sessions: readonly SessionHistoryEntry[], limit = 10): TrendPoint[] {
  return sessions
    .filter((s) => s.correct + s.incorrect > 0)
    .slice(0, limit)
    .reverse()
    .map((s) => ({
      id: s.id,
      accuracy: s.correct / (s.correct + s.incorrect),
      answered: s.correct + s.incorrect,
      completedAt: s.completedAt,
    }));
}

/** Change in accuracy between the older and newer half of recent sessions (percentage points). */
export function improvement(trend: readonly TrendPoint[]): number | null {
  if (trend.length < 4) return null;
  const half = Math.floor(trend.length / 2);
  const avg = (pts: readonly TrendPoint[]) => pts.reduce((s, p) => s + p.accuracy, 0) / pts.length;
  return Math.round((avg(trend.slice(half)) - avg(trend.slice(0, half))) * 100);
}

export function overallAccuracy(stats: Pick<PlayerStats, 'totalAnswered' | 'totalCorrect'>): number | null {
  return stats.totalAnswered > 0 ? stats.totalCorrect / stats.totalAnswered : null;
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}
