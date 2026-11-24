import { createSessionProgress, type PublicScenario } from '@/core';
import { AppError, type AnswerOutcome, type GameRepository } from '@/types/game';

const scenarios: PublicScenario[] = Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, categoryId: 'data-privacy', text: `Scenario ${i}`, difficulty: 2 }));

const mockRepo = {
  kind: 'demo' as const,
  startSession: jest.fn(),
  nextScenarios: jest.fn(),
  submitAnswer: jest.fn(),
  completeSession: jest.fn(),
};

jest.mock('@/services/repository', () => ({
  getRepository: () => mockRepo as unknown as GameRepository,
  isDemoMode: () => true,
}));

// Imported after the mock so the store uses the fake repository.
import { useGameStore } from '@/stores/game-store';

function outcome(id: string, correct: boolean, answered: number): AnswerOutcome {
  const progress = { ...createSessionProgress('classic', 2), correct: correct ? answered : 0, incorrect: correct ? 0 : answered };
  return {
    scenarioId: id,
    selected: 'ethical',
    correct,
    correctAnswer: correct ? 'ethical' : 'unethical',
    explanation: 'Because.',
    ethicalPrinciples: ['Privacy'],
    recommendedAction: null,
    learningObjective: null,
    pointsEarned: correct ? 100 : 0,
    xpEarned: correct ? 10 : 0,
    milestone: null,
    difficultyChange: 0,
    progress,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useGameStore.getState().reset();
  mockRepo.startSession.mockResolvedValue({
    sessionId: 'sess',
    mode: 'classic',
    plannedLength: 2,
    progress: createSessionProgress('classic', 2),
    scenarios: scenarios.slice(0, 2),
  });
  mockRepo.nextScenarios.mockResolvedValue([]);
});

describe('game store', () => {
  it('starts a session and shows the first card', async () => {
    await useGameStore.getState().start('classic');
    const s = useGameStore.getState();
    expect(s.phase).toBe('ready');
    expect(s.queue[0]?.id).toBe('s0');
  });

  it('ignores rapid consecutive and simultaneous inputs (single submission)', async () => {
    let resolve!: (o: AnswerOutcome) => void;
    mockRepo.submitAnswer.mockImplementation(() => new Promise<AnswerOutcome>((r) => (resolve = r)));
    await useGameStore.getState().start('classic');

    const first = useGameStore.getState().answer('ethical'); // e.g. swipe
    const second = useGameStore.getState().answer('unethical'); // e.g. button at the same moment
    const third = useGameStore.getState().answer('ethical');
    resolve(outcome('s0', true, 1));

    expect(await second).toBeNull();
    expect(await third).toBeNull();
    expect((await first)?.correct).toBe(true);
    expect(mockRepo.submitAnswer).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().phase).toBe('correct');
  });

  it('shows educational feedback on incorrect answers and waits for the player', async () => {
    mockRepo.submitAnswer.mockResolvedValue(outcome('s0', false, 1));
    await useGameStore.getState().start('classic');
    await useGameStore.getState().answer('ethical');
    expect(useGameStore.getState().phase).toBe('incorrect');
    expect(useGameStore.getState().outcome?.explanation).toBe('Because.');
    // Still waiting — nothing auto-advances.
    expect(useGameStore.getState().queue[0]?.id).toBe('s0');
    useGameStore.getState().advance();
    expect(useGameStore.getState().queue[0]?.id).toBe('s1');
    expect(useGameStore.getState().phase).toBe('ready');
  });

  it('puts the card back and shows an error when the network fails', async () => {
    mockRepo.submitAnswer.mockRejectedValue(new AppError('network', 'offline', true));
    await useGameStore.getState().start('classic');
    const before = useGameStore.getState().cardResetKey;
    expect(await useGameStore.getState().answer('ethical')).toBeNull();
    const s = useGameStore.getState();
    expect(s.phase).toBe('ready');
    expect(s.cardResetKey).toBe(before + 1);
    expect(s.error?.during).toBe('answer');
    expect(s.queue[0]?.id).toBe('s0');
  });

  it('completes the session after the planned number of answers', async () => {
    mockRepo.submitAnswer.mockResolvedValueOnce(outcome('s0', true, 1)).mockResolvedValueOnce(outcome('s1', true, 2));
    mockRepo.completeSession.mockResolvedValue({ sessionId: 'sess', status: 'completed', answered: 2 });
    await useGameStore.getState().start('classic');
    await useGameStore.getState().answer('ethical');
    useGameStore.getState().advance();
    await useGameStore.getState().answer('ethical');
    useGameStore.getState().advance();
    await new Promise((r) => setImmediate(r));
    expect(mockRepo.completeSession).toHaveBeenCalledWith('sess', 'completed');
    expect(useGameStore.getState().phase).toBe('complete');
  });

  it('surfaces an empty scenario bank as a start error', async () => {
    mockRepo.startSession.mockRejectedValue(new AppError('empty_bank', 'none'));
    await useGameStore.getState().start('classic');
    const s = useGameStore.getState();
    expect(s.phase).toBe('error');
    expect(s.error?.during).toBe('start');
    expect(s.error?.message).toMatch(/No scenarios/);
  });

  it('only completes once even if finish is called repeatedly', async () => {
    let resolve!: (v: unknown) => void;
    mockRepo.completeSession.mockImplementation(() => new Promise<unknown>((r) => (resolve = r)));
    await useGameStore.getState().start('classic');
    const a = useGameStore.getState().finish('abandoned');
    const b = useGameStore.getState().finish('abandoned');
    resolve({ sessionId: 'sess', status: 'abandoned', answered: 0 });
    await Promise.all([a, b]);
    expect(mockRepo.completeSession).toHaveBeenCalledTimes(1);
  });

  it('ignores results from a session that was replaced (race protection)', async () => {
    let resolveStart!: (v: unknown) => void;
    mockRepo.startSession.mockImplementationOnce(() => new Promise<unknown>((r) => (resolveStart = r)));
    const stale = useGameStore.getState().start('classic');
    await useGameStore.getState().start('endless');
    resolveStart({ sessionId: 'old', mode: 'classic', plannedLength: 20, progress: createSessionProgress('classic', 2), scenarios: [] });
    await stale;
    expect(useGameStore.getState().sessionId).toBe('sess');
  });
});
