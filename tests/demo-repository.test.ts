import { mulberry32, type Scenario } from '@/core';
import { SEED_SCENARIOS } from '@/data/seed-scenarios';
import { DEMO_STORAGE_KEY, DemoRepository, type KeyValueStorage } from '@/services/demo-repository';

class MemoryStorage implements KeyValueStorage {
  map = new Map<string, string>();
  async getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  async removeItem(k: string) {
    this.map.delete(k);
  }
}

const byId = new Map(SEED_SCENARIOS.map((s) => [s.id, s]));
const correctFor = (id: string) => (byId.get(id) as Scenario).correctAnswer;
const wrongFor = (id: string) => (correctFor(id) === 'ethical' ? 'unethical' : 'ethical');

function makeRepo(storage = new MemoryStorage(), bank: readonly Scenario[] = SEED_SCENARIOS) {
  let t = 1_700_000_000_000;
  return new DemoRepository(storage, bank, mulberry32(42), () => (t += 1000));
}

async function playClassic(repo: DemoRepository, answerCorrectly: (i: number) => boolean) {
  const started = await repo.startSession('classic');
  const queue = [...started.scenarios];
  let i = 0;
  while (i < (started.plannedLength ?? 0)) {
    if (queue.length === 0) queue.push(...(await repo.nextScenarios(started.sessionId, 4)));
    const s = queue.shift();
    if (!s) break;
    await repo.submitAnswer({ sessionId: started.sessionId, scenarioId: s.id, selected: answerCorrectly(i) ? correctFor(s.id) : wrongFor(s.id), responseMs: 1500 });
    i++;
  }
  return { started, summary: await repo.completeSession(started.sessionId, 'completed') };
}

describe('DemoRepository (local demo mode)', () => {
  it('never exposes correct answers before answering', async () => {
    const repo = makeRepo();
    const started = await repo.startSession('classic');
    for (const s of started.scenarios) {
      expect(Object.keys(s).sort()).toEqual(['categoryId', 'difficulty', 'id', 'text']);
    }
  });

  it('plays a full 20-scenario Classic session with no repeats', async () => {
    const repo = makeRepo();
    const seen = new Set<string>();
    const started = await repo.startSession('classic');
    expect(started.plannedLength).toBe(20);
    expect(started.progress.difficulty).toBe(2);
    let queue = [...started.scenarios];
    for (let i = 0; i < 20; i++) {
      if (queue.length === 0) queue = await repo.nextScenarios(started.sessionId, 4);
      const s = queue.shift()!;
      expect(seen.has(s.id)).toBe(false);
      seen.add(s.id);
      await repo.submitAnswer({ sessionId: started.sessionId, scenarioId: s.id, selected: correctFor(s.id), responseMs: 1000 });
    }
    expect(await repo.nextScenarios(started.sessionId, 4)).toEqual([]);
    const summary = await repo.completeSession(started.sessionId, 'completed');
    expect(summary.answered).toBe(20);
    expect(summary.accuracy).toBe(1);
    expect(summary.progress.bestStreak).toBe(20);
    expect(summary.progress.difficulty).toBeGreaterThan(2);
    expect(summary.completionXp).toBeGreaterThan(0);
  });

  it('treats duplicate submissions idempotently', async () => {
    const repo = makeRepo();
    const started = await repo.startSession('classic');
    const s = started.scenarios[0]!;
    const sub = { sessionId: started.sessionId, scenarioId: s.id, selected: correctFor(s.id), responseMs: 900 };
    const [a, b] = await Promise.all([repo.submitAnswer(sub), repo.submitAnswer(sub)]);
    expect(a).toBe(b);
    const stats = await repo.getPlayerStats();
    expect(stats.totalAnswered).toBe(1);
  });

  it('rejects answers for scenarios that were not served', async () => {
    const repo = makeRepo();
    const started = await repo.startSession('classic');
    const unserved = SEED_SCENARIOS.find((s) => !started.scenarios.some((p) => p.id === s.id))!;
    await expect(
      repo.submitAnswer({ sessionId: started.sessionId, scenarioId: unserved.id, selected: 'ethical', responseMs: 0 }),
    ).rejects.toMatchObject({ code: 'not_served' });
  });

  it('records mistakes for review and reveals explanations', async () => {
    const repo = makeRepo();
    const { summary } = await playClassic(repo, (i) => i % 4 !== 0);
    expect(summary.mistakes).toHaveLength(5);
    expect(summary.mistakes[0]?.explanation.explanation.length).toBeGreaterThan(10);
    const items = await repo.getReviewItems();
    expect(items.filter((i) => !i.reviewed)).toHaveLength(5);
  });

  it('Smart Review serves missed scenarios first and marks them reviewed when answered correctly', async () => {
    const repo = makeRepo();
    await playClassic(repo, (i) => i >= 3);
    const missed = (await repo.getReviewItems()).map((i) => i.scenario.id);
    expect(missed).toHaveLength(3);

    const review = await repo.startSession('review');
    expect(review.scenarios.slice(0, 3).map((s) => s.id).sort()).toEqual([...missed].sort());
    for (const id of missed) {
      await repo.submitAnswer({ sessionId: review.sessionId, scenarioId: id, selected: correctFor(id), responseMs: 500 });
    }
    const after = await repo.getReviewItems();
    expect(after.every((i) => i.reviewed)).toBe(true);
  });

  it('lets players manually mark a scenario as reviewed', async () => {
    const repo = makeRepo();
    await playClassic(repo, (i) => i !== 0);
    const [item] = await repo.getReviewItems();
    await repo.markReviewed(item!.scenario.id);
    expect((await repo.getReviewItems())[0]?.reviewed).toBe(true);
    expect((await repo.getPlayerStats()).pendingReviewCount).toBe(0);
  });

  it('persists progress across app restarts and keeps it under a demo-only key', async () => {
    const storage = new MemoryStorage();
    await playClassic(makeRepo(storage), () => true);
    expect([...storage.map.keys()]).toEqual([DEMO_STORAGE_KEY]);
    const reloaded = await makeRepo(storage).getPlayerStats();
    expect(reloaded.totalAnswered).toBe(20);
    expect(reloaded.sessionsCompleted).toBe(1);
    expect(reloaded.highestStreak).toBe(20);
    expect(reloaded.currentDifficulty).toBeGreaterThan(2);
    expect(reloaded.recentSessions).toHaveLength(1);
  });

  it('recovers from corrupt local data', async () => {
    const storage = new MemoryStorage();
    storage.map.set(DEMO_STORAGE_KEY, '{not json');
    const stats = await makeRepo(storage).getPlayerStats();
    expect(stats.totalAnswered).toBe(0);
  });

  it('reports an empty scenario bank clearly', async () => {
    const repo = makeRepo(new MemoryStorage(), []);
    await expect(repo.startSession('classic')).rejects.toMatchObject({ code: 'empty_bank' });
  });

  it('abandoned sessions earn no completion bonus', async () => {
    const repo = makeRepo();
    const started = await repo.startSession('classic');
    for (const s of started.scenarios) {
      await repo.submitAnswer({ sessionId: started.sessionId, scenarioId: s.id, selected: correctFor(s.id), responseMs: 1 });
    }
    const summary = await repo.completeSession(started.sessionId, 'abandoned');
    expect(summary.status).toBe('abandoned');
    expect(summary.completionXp).toBe(0);
    expect((await repo.getPlayerStats()).sessionsCompleted).toBe(0);
  });

  it('completing twice returns the same summary (no double XP)', async () => {
    const repo = makeRepo();
    const { started, summary } = await playClassic(repo, () => true);
    const again = await repo.completeSession(started.sessionId, 'completed');
    expect(again).toBe(summary);
    expect((await repo.getPlayerStats()).totalXp).toBe(summary.totalXp);
  });

  it('Endless mode keeps serving scenarios beyond the local bank size', async () => {
    const small = SEED_SCENARIOS.slice(0, 8);
    const repo = makeRepo(new MemoryStorage(), small);
    const started = await repo.startSession('endless');
    expect(started.plannedLength).toBeNull();
    let served = started.scenarios.length;
    for (let i = 0; i < 5; i++) served += (await repo.nextScenarios(started.sessionId, 4)).length;
    expect(served).toBeGreaterThan(small.length);
  });
});
