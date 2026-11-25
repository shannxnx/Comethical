import { CALIBRATION_MIN_ANSWERS, calibrate, expectedAccuracy } from '@/features/admin/calibration';

describe('admin difficulty calibration', () => {
  it('expects lower accuracy for harder scenarios', () => {
    expect(expectedAccuracy(1)).toBeCloseTo(0.95);
    expect(expectedAccuracy(10)).toBeCloseTo(0.41);
    expect(expectedAccuracy(5)).toBeLessThan(expectedAccuracy(4));
  });

  it('waits for enough answers before judging', () => {
    expect(calibrate({ difficulty: 9, timesAnswered: CALIBRATION_MIN_ANSWERS - 1, timesCorrect: 9 }).kind).toBe('insufficient');
    expect(calibrate({ difficulty: 5, timesAnswered: 0, timesCorrect: 0 }).observed).toBeNull();
  });

  it('flags scenarios that play easier or harder than rated', () => {
    expect(calibrate({ difficulty: 9, timesAnswered: 20, timesCorrect: 19 }).kind).toBe('easier');
    expect(calibrate({ difficulty: 1, timesAnswered: 20, timesCorrect: 8 }).kind).toBe('harder');
    expect(calibrate({ difficulty: 5, timesAnswered: 20, timesCorrect: 14 }).kind).toBe('ok');
  });
});
