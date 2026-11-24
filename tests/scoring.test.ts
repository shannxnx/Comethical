import {
  LEVELING,
  SCORING,
  calculateAnswerXp,
  calculateCompletionXp,
  calculatePoints,
  getDifficultyTier,
  getLevelProgress,
  getRankForLevel,
  getStreakMilestone,
  getStreakMultiplier,
  totalXpForLevel,
  xpForNextLevel,
} from '@/core';

describe('difficulty tiers', () => {
  it.each([
    [1, 'beginner'],
    [2, 'beginner'],
    [3, 'easy'],
    [5, 'intermediate'],
    [8, 'advanced'],
    [10, 'expert'],
  ])('difficulty %i is %s', (d, tier) => {
    expect(getDifficultyTier(d).id).toBe(tier);
  });

  it('clamps out-of-range values', () => {
    expect(getDifficultyTier(0).id).toBe('beginner');
    expect(getDifficultyTier(42).id).toBe('expert');
    expect(getDifficultyTier(Number.NaN).id).toBe('beginner');
  });
});

describe('streak multipliers', () => {
  it.each([
    [1, 1],
    [4, 1],
    [5, 1.25],
    [9, 1.25],
    [10, 1.5],
    [19, 1.5],
    [20, 2],
    [29, 2],
    [30, 3],
    [100, 3],
  ])('streak %i → %fx', (streak, multiplier) => {
    expect(getStreakMultiplier(streak)).toBe(multiplier);
  });
});

describe('points', () => {
  it('uses base points per tier', () => {
    expect(calculatePoints(1, 1)).toBe(100);
    expect(calculatePoints(3, 1)).toBe(125);
    expect(calculatePoints(6, 1)).toBe(150);
    expect(calculatePoints(7, 1)).toBe(200);
    expect(calculatePoints(10, 1)).toBe(250);
  });

  it('applies the streak multiplier', () => {
    expect(calculatePoints(5, 5)).toBe(188); // 150 × 1.25 = 187.5 → 188
    expect(calculatePoints(10, 30)).toBe(750);
  });
});

describe('XP', () => {
  it('awards nothing for incorrect answers', () => {
    expect(calculateAnswerXp({ correct: false, difficulty: 9, isReviewOfMistake: true, streak: 0 })).toBe(0);
  });

  it('awards tier XP plus review and milestone bonuses', () => {
    expect(calculateAnswerXp({ correct: true, difficulty: 1, isReviewOfMistake: false, streak: 1 })).toBe(SCORING.xpPerCorrect.beginner);
    expect(calculateAnswerXp({ correct: true, difficulty: 1, isReviewOfMistake: true, streak: 1 })).toBe(
      SCORING.xpPerCorrect.beginner + SCORING.reviewCorrectBonusXp,
    );
    expect(calculateAnswerXp({ correct: true, difficulty: 9, isReviewOfMistake: false, streak: 10 })).toBe(
      SCORING.xpPerCorrect.expert + (SCORING.streakMilestoneXp[10] ?? 0),
    );
  });

  it('detects streak milestones exactly', () => {
    expect(getStreakMilestone(5)).toBe(5);
    expect(getStreakMilestone(6)).toBeNull();
    expect(getStreakMilestone(30)).toBe(30);
  });

  it('pays completion XP only above the minimum answer count', () => {
    expect(calculateCompletionXp('classic', SCORING.minAnswersForCompletionXp - 1)).toBe(0);
    expect(calculateCompletionXp('classic', 20)).toBe(SCORING.sessionCompletionXp.classic);
  });
});

describe('levels and ranks', () => {
  it('requires increasing XP per level', () => {
    expect(xpForNextLevel(1)).toBe(LEVELING.baseXp);
    expect(xpForNextLevel(2)).toBe(LEVELING.baseXp + LEVELING.xpGrowthPerLevel);
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(3)).toBe(xpForNextLevel(1) + xpForNextLevel(2));
  });

  it('computes level progress at boundaries', () => {
    expect(getLevelProgress(0)).toMatchObject({ level: 1, xpIntoLevel: 0, progress: 0 });
    expect(getLevelProgress(LEVELING.baseXp - 1).level).toBe(1);
    expect(getLevelProgress(LEVELING.baseXp).level).toBe(2);
    expect(getLevelProgress(totalXpForLevel(5) + 10)).toMatchObject({ level: 5, xpIntoLevel: 10 });
  });

  it('never exceeds the max level', () => {
    const p = getLevelProgress(10_000_000);
    expect(p.level).toBe(LEVELING.maxLevel);
    expect(p.progress).toBe(1);
  });

  it('maps levels to the six ranks', () => {
    expect(LEVELING.ranks).toHaveLength(6);
    expect(getRankForLevel(1).title).toBe('Digital Rookie');
    expect(getRankForLevel(4).title).toBe('Ethical Explorer');
    expect(getRankForLevel(8).title).toBe('Digital Guardian');
    expect(getRankForLevel(13).title).toBe('Cyber Sentinel');
    expect(getRankForLevel(20).title).toBe('Ethics Master');
    expect(getRankForLevel(30).title).toBe('Ethical Legend');
  });
});
