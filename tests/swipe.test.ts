import { SWIPE, answerToDirection, directionToAnswer, resolveSwipe, swipeProgress } from '@/core';

describe('swipe direction mapping', () => {
  it('maps LEFT to Ethical and RIGHT to Unethical', () => {
    expect(directionToAnswer('left')).toBe('ethical');
    expect(directionToAnswer('right')).toBe('unethical');
  });

  it('round-trips answers and directions', () => {
    expect(answerToDirection('ethical')).toBe('left');
    expect(answerToDirection('unethical')).toBe('right');
  });
});

describe('resolveSwipe', () => {
  const width = 400;
  const threshold = width * SWIPE.thresholdRatio;

  it('commits once the distance threshold is crossed', () => {
    expect(resolveSwipe(-threshold, 0, width)).toBe('left');
    expect(resolveSwipe(threshold, 0, width)).toBe('right');
  });

  it('cancels below the threshold without velocity', () => {
    expect(resolveSwipe(threshold - 1, 0, width)).toBeNull();
    expect(resolveSwipe(-(threshold - 1), 0, width)).toBeNull();
    expect(resolveSwipe(0, 0, width)).toBeNull();
  });

  it('accepts a fast fling in the drag direction', () => {
    expect(resolveSwipe(-60, -SWIPE.velocityThreshold - 1, width)).toBe('left');
    expect(resolveSwipe(60, SWIPE.velocityThreshold + 1, width)).toBe('right');
  });

  it('ignores flings that are too short or that reverse direction', () => {
    expect(resolveSwipe(10, 5000, width)).toBeNull();
    expect(resolveSwipe(80, -5000, width)).toBeNull();
  });

  it('respects a custom threshold configuration', () => {
    const config = { ...SWIPE, thresholdRatio: 0.5 };
    expect(resolveSwipe(150, 0, width, config)).toBeNull();
    expect(resolveSwipe(200, 0, width, config)).toBe('right');
  });

  it('reports progress towards the threshold, capped at 1', () => {
    expect(swipeProgress(0, width)).toBe(0);
    expect(swipeProgress(threshold / 2, width)).toBeCloseTo(0.5);
    expect(swipeProgress(-threshold * 3, width)).toBe(1);
  });
});
