import {
  ADAPTIVE_DIFFICULTY,
  GAME_MODES,
  SESSION,
  applyAnswer,
  categoryWeakness,
  completeSessionProgress,
  createSessionProgress,
  DEFAULT_CATEGORIES,
  getLevelProgress,
  isAnswerCorrect,
  selectReviewScenarios,
  selectScenarios,
  type AnswerRecord,
  type Category,
  type CategoryTally,
  type GameModeId,
  type PublicScenario,
  type Scenario,
  type SessionProgress,
} from '@/core';
import { SEED_SCENARIOS } from '@/data/seed-scenarios';
import {
  AppError,
  type AnswerOutcome,
  type AnswerSubmission,
  type GameRepository,
  type PlayerStats,
  type ReportReason,
  type ReviewItem,
  type SessionHistoryEntry,
  type SessionSummary,
  type StartSessionOptions,
  type StartedSession,
  type TopicStat,
} from '@/types/game';

/**
 * LOCAL DEMO MODE repository.
 * Runs the same core rules as the server against the bundled seed scenarios and stores
 * progress on-device under a demo-only key, so it can never mix with real account data.
 */

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const DEMO_STORAGE_KEY = 'comethical.demo.v1';
const MAX_ANSWERS = 500;
const MAX_SESSIONS = 100;

interface DemoReviewEntry {
  selected: 'ethical' | 'unethical';
  timesMissed: number;
  lastMissedAt: number;
  reviewed: boolean;
  reviewedAt: number | null;
}

export interface DemoData {
  version: 1;
  username: string;
  totalXp: number;
  highestStreak: number;
  currentDifficulty: number;
  totalAnswered: number;
  totalCorrect: number;
  sessionsCompleted: number;
  answers: AnswerRecord[];
  sessions: SessionHistoryEntry[];
  topicStats: Record<string, TopicStat>;
  review: Record<string, DemoReviewEntry>;
  bestScores: Partial<Record<GameModeId, number>>;
  bestStreaks: Partial<Record<GameModeId, number>>;
  reports: { scenarioId: string; reason: ReportReason; description?: string; at: number }[];
}

export function emptyDemoData(): DemoData {
  return {
    version: 1,
    username: 'Demo Player',
    totalXp: 0,
    highestStreak: 0,
    currentDifficulty: ADAPTIVE_DIFFICULTY.startLevel,
    totalAnswered: 0,
    totalCorrect: 0,
    sessionsCompleted: 0,
    answers: [],
    sessions: [],
    topicStats: {},
    review: {},
    bestScores: {},
    bestStreaks: {},
    reports: [],
  };
}

interface DemoSession {
  id: string;
  mode: GameModeId;
  plannedLength: number | null;
  progress: SessionProgress;
  served: string[];
  outcomes: Map<string, AnswerOutcome>;
  summary: SessionSummary | null;
  highestStreakBefore: number;
}

function toPublic(s: Scenario): PublicScenario {
  return { id: s.id, categoryId: s.categoryId, text: s.text, difficulty: s.difficulty };
}

export class DemoRepository implements GameRepository {
  readonly kind = 'demo' as const;
  private data: DemoData | null = null;
  private loading: Promise<DemoData> | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  private sessions = new Map<string, DemoSession>();
  private submissions = new Map<string, Promise<AnswerOutcome>>();
  private bankById: Map<string, Scenario>;
  private sessionCounter = 0;

  constructor(
    private storage: KeyValueStorage,
    private bank: readonly Scenario[] = SEED_SCENARIOS,
    private rng: () => number = Math.random,
    private now: () => number = Date.now,
  ) {
    this.bankById = new Map(bank.map((s) => [s.id, s]));
  }

  // ── persistence ──────────────────────────────────────────────────────────
  private async load(): Promise<DemoData> {
    if (this.data) return this.data;
    if (!this.loading) {
      this.loading = (async () => {
        let parsed: DemoData | null = null;
        try {
          const raw = await this.storage.getItem(DEMO_STORAGE_KEY);
          const candidate = raw ? (JSON.parse(raw) as Partial<DemoData>) : null;
          if (candidate && candidate.version === 1) parsed = { ...emptyDemoData(), ...candidate } as DemoData;
        } catch {
          parsed = null; // Corrupt local data: start fresh rather than crash.
        }
        this.data = parsed ?? emptyDemoData();
        return this.data;
      })();
    }
    return this.loading;
  }

  private save(): Promise<void> {
    const snapshot = JSON.stringify(this.data);
    this.writeChain = this.writeChain
      .then(() => this.storage.setItem(DEMO_STORAGE_KEY, snapshot))
      .catch((e) => console.warn('Could not save demo progress', e));
    return this.writeChain;
  }

  private approvedPool(): Scenario[] {
    const active = new Set(DEFAULT_CATEGORIES.filter((c) => c.active).map((c) => c.id));
    return this.bank.filter((s) => s.status === 'approved' && active.has(s.categoryId));
  }

  private getSession(sessionId: string): DemoSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new AppError('session_not_found', 'This session is no longer available.');
    return session;
  }

  private weakness(data: DemoData): Record<string, number> {
    const tallies: Record<string, CategoryTally> = {};
    for (const [id, t] of Object.entries(data.topicStats)) tallies[id] = { correct: t.correct, incorrect: t.incorrect };
    return categoryWeakness(tallies);
  }

  // ── GameRepository ───────────────────────────────────────────────────────
  async getCategories(): Promise<Category[]> {
    return DEFAULT_CATEGORIES.filter((c) => c.active);
  }

  async startSession(mode: GameModeId, options: StartSessionOptions = {}): Promise<StartedSession> {
    const data = await this.load();
    const definition = GAME_MODES[mode];
    const pool = this.approvedPool();
    if (pool.length === 0) throw new AppError('empty_bank', 'No scenarios are available yet.');

    const recentIds = new Set(data.answers.slice(-SESSION.recentAvoidWindow).map((a) => a.scenarioId));
    const weakness = this.weakness(data);
    let picked: Scenario[];
    let plannedLength: number | null;

    if (options.scenarioIds && options.scenarioIds.length > 0) {
      picked = options.scenarioIds.map((id) => this.bankById.get(id)).filter((s): s is Scenario => Boolean(s));
      plannedLength = picked.length;
    } else if (definition.source === 'review') {
      const missedIds = Object.entries(data.review)
        .filter(([, r]) => !r.reviewed)
        .sort(([, a], [, b]) => b.timesMissed - a.timesMissed || b.lastMissedAt - a.lastMissedAt)
        .map(([id]) => id);
      picked = selectReviewScenarios({
        pool,
        missedIds,
        count: definition.sessionLength ?? 10,
        targetDifficulty: data.currentDifficulty,
        excludeIds: new Set(),
        categoryWeakness: weakness,
        rng: this.rng,
      });
      plannedLength = picked.length;
    } else {
      plannedLength = definition.sessionLength;
      picked = selectScenarios(pool, {
        targetDifficulty: data.currentDifficulty,
        count: Math.min(SESSION.prefetchSize, plannedLength ?? SESSION.prefetchSize),
        excludeIds: new Set(),
        recentIds,
        categoryWeakness: weakness,
        rng: this.rng,
      });
    }
    if (picked.length === 0) throw new AppError('empty_bank', 'No scenarios are available for this mode yet.');

    this.sessionCounter += 1;
    const id = `demo-${this.now()}-${this.sessionCounter}`;
    const session: DemoSession = {
      id,
      mode,
      plannedLength,
      progress: createSessionProgress(mode, data.currentDifficulty),
      served: picked.map((s) => s.id),
      outcomes: new Map(),
      summary: null,
      highestStreakBefore: data.highestStreak,
    };
    this.sessions.set(id, session);
    return { sessionId: id, mode, plannedLength, progress: session.progress, scenarios: picked.map(toPublic) };
  }

  async nextScenarios(sessionId: string, requested: number): Promise<PublicScenario[]> {
    const data = await this.load();
    const session = this.getSession(sessionId);
    if (session.summary) return [];
    const remaining = session.plannedLength === null ? 10 : session.plannedLength - session.served.length;
    const count = Math.max(0, Math.min(10, requested, remaining));
    if (count === 0) return [];

    const lastServed = session.served
      .slice(-SESSION.maxSameAnswerRun)
      .map((id) => this.bankById.get(id))
      .filter((s): s is Scenario => Boolean(s));
    let picked = selectScenarios(this.approvedPool(), {
      targetDifficulty: session.progress.difficulty,
      count,
      excludeIds: new Set(session.served),
      recentIds: new Set(data.answers.slice(-SESSION.recentAvoidWindow).map((a) => a.scenarioId)),
      categoryWeakness: this.weakness(data),
      previousAnswers: lastServed.map((s) => s.correctAnswer),
      previousCategoryId: lastServed[lastServed.length - 1]?.categoryId ?? null,
      rng: this.rng,
    });
    // Endless mode on a small local bank: once everything was served, allow repeats
    // (oldest first) rather than ending the session.
    if (picked.length === 0 && session.plannedLength === null) {
      const recentlyServed = new Set(session.served.slice(-Math.floor(this.approvedPool().length / 2)));
      picked = selectScenarios(this.approvedPool(), {
        targetDifficulty: session.progress.difficulty,
        count,
        excludeIds: recentlyServed,
        rng: this.rng,
      });
    }
    session.served.push(...picked.map((s) => s.id));
    return picked.map(toPublic);
  }

  submitAnswer(submission: AnswerSubmission): Promise<AnswerOutcome> {
    // Duplicate / concurrent submission of the same card: return the original result.
    // The check and registration happen synchronously, before any await.
    const key = `${submission.sessionId}:${submission.scenarioId}`;
    const inFlight = this.submissions.get(key);
    if (inFlight) return inFlight;
    const promise = this.recordAnswer(submission);
    this.submissions.set(key, promise);
    promise.catch(() => this.submissions.delete(key)); // failed attempts may be retried
    return promise;
  }

  private async recordAnswer(submission: AnswerSubmission): Promise<AnswerOutcome> {
    const data = await this.load();
    const session = this.getSession(submission.sessionId);
    const previous = session.outcomes.get(submission.scenarioId);
    if (previous) return previous;
    if (session.summary) throw new AppError('session_not_active', 'This session has ended.');
    if (!session.served.includes(submission.scenarioId)) {
      throw new AppError('not_served', 'This scenario is not part of the session.');
    }
    const scenario = this.bankById.get(submission.scenarioId);
    if (!scenario) throw new AppError('not_found', 'Scenario not found.');

    const mode = GAME_MODES[session.mode];
    const correct = isAnswerCorrect(submission.selected, scenario.correctAnswer);
    const adaptiveModes = new Set(Object.values(GAME_MODES).filter((m) => m.adaptiveDifficulty).map((m) => m.id));
    const recentResults = data.answers
      .filter((a) => adaptiveModes.has(a.mode))
      .slice(-(ADAPTIVE_DIFFICULTY.windowSize - 1))
      .map((a) => a.correct);
    recentResults.push(correct);
    const reviewEntry = data.review[scenario.id];

    const result = applyAnswer(session.progress, {
      correct,
      scenarioDifficulty: scenario.difficulty,
      categoryId: scenario.categoryId,
      isReviewOfMistake: Boolean(reviewEntry && !reviewEntry.reviewed),
      recentResults,
    });
    session.progress = result.progress;

    // Persist learning data.
    const at = this.now();
    data.answers.push({
      scenarioId: scenario.id,
      categoryId: scenario.categoryId,
      correct,
      difficulty: scenario.difficulty,
      mode: session.mode,
      answeredAt: at,
    });
    if (data.answers.length > MAX_ANSWERS) data.answers.splice(0, data.answers.length - MAX_ANSWERS);
    const topic = data.topicStats[scenario.categoryId] ?? { correct: 0, incorrect: 0, lastPracticedAt: null };
    data.topicStats[scenario.categoryId] = {
      correct: topic.correct + (correct ? 1 : 0),
      incorrect: topic.incorrect + (correct ? 0 : 1),
      lastPracticedAt: at,
    };
    if (correct) {
      if (reviewEntry && mode.marksReviewed) data.review[scenario.id] = { ...reviewEntry, reviewed: true, reviewedAt: at };
    } else {
      data.review[scenario.id] = {
        selected: submission.selected,
        timesMissed: (reviewEntry?.timesMissed ?? 0) + 1,
        lastMissedAt: at,
        reviewed: false,
        reviewedAt: null,
      };
    }
    data.totalXp += result.xpEarned;
    data.totalAnswered += 1;
    data.totalCorrect += correct ? 1 : 0;
    data.highestStreak = Math.max(data.highestStreak, result.progress.bestStreak);
    if (mode.adaptiveDifficulty) data.currentDifficulty = result.progress.difficulty;
    await this.save();

    const outcome: AnswerOutcome = {
      scenarioId: scenario.id,
      selected: submission.selected,
      correct,
      correctAnswer: scenario.correctAnswer,
      explanation: scenario.explanation,
      ethicalPrinciples: scenario.ethicalPrinciples,
      recommendedAction: scenario.recommendedAction,
      learningObjective: scenario.learningObjective,
      pointsEarned: result.pointsEarned,
      xpEarned: result.xpEarned,
      milestone: result.milestone,
      difficultyChange: result.difficultyChange,
      progress: result.progress,
    };
    session.outcomes.set(scenario.id, outcome);
    return outcome;
  }

  async completeSession(sessionId: string, status: 'completed' | 'abandoned'): Promise<SessionSummary> {
    const data = await this.load();
    const session = this.getSession(sessionId);
    if (session.summary) return session.summary;

    const answered = session.progress.correct + session.progress.incorrect;
    const totalBefore = data.totalXp - session.progress.xpEarned;
    const completion = status === 'completed' ? completeSessionProgress(session.progress) : null;
    const completionXp = completion?.completionXp ?? 0;
    const progress = completion?.progress ?? session.progress;

    data.totalXp += completionXp;
    if (status === 'completed') data.sessionsCompleted += 1;
    if (answered > 0) {
      data.sessions.unshift({
        id: session.id,
        mode: session.mode,
        score: progress.score,
        correct: progress.correct,
        incorrect: progress.incorrect,
        bestStreak: progress.bestStreak,
        xpEarned: progress.xpEarned,
        endingDifficulty: progress.difficulty,
        completedAt: this.now(),
        status,
      });
      if (data.sessions.length > MAX_SESSIONS) data.sessions.length = MAX_SESSIONS;
      data.bestScores[session.mode] = Math.max(data.bestScores[session.mode] ?? 0, progress.score);
      data.bestStreaks[session.mode] = Math.max(data.bestStreaks[session.mode] ?? 0, progress.bestStreak);
    }
    await this.save();

    const mistakes: ReviewItem[] = [];
    for (const outcome of session.outcomes.values()) {
      if (outcome.correct) continue;
      const s = this.bankById.get(outcome.scenarioId);
      if (!s) continue;
      mistakes.push({
        scenario: toPublic(s),
        explanation: {
          correctAnswer: s.correctAnswer,
          explanation: s.explanation,
          ethicalPrinciples: s.ethicalPrinciples,
          recommendedAction: s.recommendedAction,
          learningObjective: s.learningObjective,
        },
        selected: outcome.selected,
        timesMissed: data.review[s.id]?.timesMissed ?? 1,
        lastMissedAt: data.review[s.id]?.lastMissedAt ?? this.now(),
        reviewed: false,
        reviewedAt: null,
      });
    }

    session.summary = {
      sessionId,
      mode: session.mode,
      status,
      progress,
      completionXp,
      totalXpEarned: progress.xpEarned,
      answered,
      accuracy: answered > 0 ? progress.correct / answered : 0,
      levelBefore: getLevelProgress(Math.max(0, totalBefore)).level,
      levelAfter: getLevelProgress(data.totalXp).level,
      totalXp: data.totalXp,
      isNewBestStreak: progress.bestStreak > session.highestStreakBefore,
      mistakes,
    };
    return session.summary;
  }

  async getPlayerStats(): Promise<PlayerStats> {
    const data = await this.load();
    return {
      username: data.username,
      totalXp: data.totalXp,
      highestStreak: data.highestStreak,
      totalAnswered: data.totalAnswered,
      totalCorrect: data.totalCorrect,
      sessionsCompleted: data.sessionsCompleted,
      currentDifficulty: data.currentDifficulty,
      topicStats: { ...data.topicStats },
      recentSessions: data.sessions.slice(0, 30),
      bestScores: { ...data.bestScores },
      bestStreaks: { ...data.bestStreaks },
      pendingReviewCount: Object.values(data.review).filter((r) => !r.reviewed).length,
    };
  }

  async getReviewItems(): Promise<ReviewItem[]> {
    const data = await this.load();
    const items: ReviewItem[] = [];
    for (const [id, r] of Object.entries(data.review)) {
      const s = this.bankById.get(id);
      if (!s) continue;
      items.push({
        scenario: toPublic(s),
        explanation: {
          correctAnswer: s.correctAnswer,
          explanation: s.explanation,
          ethicalPrinciples: s.ethicalPrinciples,
          recommendedAction: s.recommendedAction,
          learningObjective: s.learningObjective,
        },
        selected: r.selected,
        timesMissed: r.timesMissed,
        lastMissedAt: r.lastMissedAt,
        reviewed: r.reviewed,
        reviewedAt: r.reviewedAt,
      });
    }
    return items.sort((a, b) => Number(a.reviewed) - Number(b.reviewed) || b.lastMissedAt - a.lastMissedAt);
  }

  async markReviewed(scenarioId: string): Promise<void> {
    const data = await this.load();
    const entry = data.review[scenarioId];
    if (!entry) return;
    data.review[scenarioId] = { ...entry, reviewed: true, reviewedAt: this.now() };
    await this.save();
  }

  async reportScenario(scenarioId: string, reason: ReportReason, description?: string): Promise<void> {
    const data = await this.load();
    data.reports.push({ scenarioId, reason, description, at: this.now() });
    await this.save();
  }

  async updateUsername(username: string): Promise<void> {
    const data = await this.load();
    data.username = username;
    await this.save();
  }

  async resetProgress(): Promise<void> {
    this.data = emptyDemoData();
    this.sessions.clear();
    this.submissions.clear();
    await this.storage.removeItem(DEMO_STORAGE_KEY);
  }
}
