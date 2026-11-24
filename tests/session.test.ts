import {
  SCORING,
  applyAnswer,
  completeSessionProgress,
  createSessionProgress,
  isAnswerCorrect,
  isSessionComplete,
  type SessionProgress,
} from '@/core';

function answer(progress: SessionProgress, correct: boolean, history: boolean[] = [], difficulty = 3) {
  return applyAnswer(progress, {
    correct,
    scenarioDifficulty: difficulty,
    categoryId: 'data-privacy',
    isReviewOfMistake: false,
    recentResults: [...history, correct],
  });
}

describe('answer correctness', () => {
  it('compares the selection to the correct answer', () => {
    expect(isAnswerCorrect('ethical', 'ethical')).toBe(true);
    expect(isAnswerCorrect('unethical', 'ethical')).toBe(false);
  });
});

describe('session reducer', () => {
  it('increments score, streak and XP on correct answers', () => {
    const r = answer(createSessionProgress('classic', 2), true);
    expect(r.progress).toMatchObject({ correct: 1, incorrect: 0, streak: 1, bestStreak: 1, score: 125 });
    expect(r.pointsEarned).toBe(125);
    expect(r.xpEarned).toBe(SCORING.xpPerCorrect.easy);
  });

  it('resets the streak on an incorrect answer but keeps the best streak', () => {
    let p = createSessionProgress('classic', 2);
    for (let i = 0; i < 3; i++) p = answer(p, true).progress;
    const r = answer(p, false);
    expect(r.progress.streak).toBe(0);
    expect(r.progress.bestStreak).toBe(3);
    expect(r.pointsEarned).toBe(0);
    expect(r.progress.score).toBe(p.score);
  });

  it('reports streak milestones and applies multipliers', () => {
    let p = createSessionProgress('classic', 2);
    let last;
    for (let i = 0; i < 5; i++) {
      last = answer(p, true);
      p = last.progress;
    }
    expect(last?.milestone).toBe(5);
    expect(last?.pointsEarned).toBe(Math.round(125 * 1.25));
  });

  it('tracks per-category results', () => {
    let p = createSessionProgress('classic', 2);
    p = answer(p, true).progress;
    p = answer(p, false).progress;
    expect(p.categoryResults['data-privacy']).toEqual({ correct: 1, incorrect: 1 });
  });

  it('raises difficulty after sustained accuracy and resets the cooldown', () => {
    let p = createSessionProgress('classic', 2);
    const history: boolean[] = [];
    let changed = false;
    for (let i = 0; i < 8 && !changed; i++) {
      const r = answer(p, true, history);
      history.push(true);
      p = r.progress;
      if (r.difficultyChange === 1) changed = true;
    }
    expect(changed).toBe(true);
    expect(p.difficulty).toBe(3);
    expect(p.answersSinceAdjustment).toBe(0);
    expect(p.maxDifficulty).toBe(3);
  });

  it('does not adapt difficulty in Smart Review', () => {
    let p = createSessionProgress('review', 4);
    for (let i = 0; i < 10; i++) p = answer(p, true, Array(10).fill(true)).progress;
    expect(p.difficulty).toBe(4);
  });

  it('gives the review bonus only in review modes', () => {
    const input = { correct: true, scenarioDifficulty: 1, categoryId: 'x', isReviewOfMistake: true, recentResults: [true] };
    const inReview = applyAnswer(createSessionProgress('review', 2), input);
    const inClassic = applyAnswer(createSessionProgress('classic', 2), input);
    expect(inReview.xpEarned - inClassic.xpEarned).toBe(SCORING.reviewCorrectBonusXp);
  });
});

describe('session completion', () => {
  it('completes fixed-length sessions at the planned length', () => {
    let p = createSessionProgress('classic', 2);
    for (let i = 0; i < 19; i++) p = answer(p, i % 2 === 0).progress;
    expect(isSessionComplete(p, 20)).toBe(false);
    p = answer(p, true).progress;
    expect(isSessionComplete(p, 20)).toBe(true);
  });

  it('never auto-completes endless sessions', () => {
    let p = createSessionProgress('endless', 2);
    for (let i = 0; i < 50; i++) p = answer(p, true).progress;
    expect(isSessionComplete(p, null)).toBe(false);
  });

  it('adds completion XP once enough answers were given', () => {
    let p = createSessionProgress('classic', 2);
    for (let i = 0; i < 5; i++) p = answer(p, true).progress;
    const done = completeSessionProgress(p);
    expect(done.completionXp).toBe(SCORING.sessionCompletionXp.classic);
    expect(done.progress.xpEarned).toBe(p.xpEarned + SCORING.sessionCompletionXp.classic);
  });

  it('pays no completion XP for an empty session', () => {
    expect(completeSessionProgress(createSessionProgress('classic', 2)).completionXp).toBe(0);
  });
});
