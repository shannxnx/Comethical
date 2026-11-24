// GENERATED from src/core by `npm run sync:core`. Do not edit here.
import { SWIPE, type SwipeConfig } from './game.config.ts';
import type { EthicalAnswer, SwipeDirection } from './types.ts';

/**
 * Controls are fixed by design:
 *   swipe LEFT  = Ethical
 *   swipe RIGHT = Unethical
 */
export function directionToAnswer(direction: SwipeDirection): EthicalAnswer {
  return direction === 'left' ? 'ethical' : 'unethical';
}

export function answerToDirection(answer: EthicalAnswer): SwipeDirection {
  return answer === 'ethical' ? 'left' : 'right';
}

/**
 * Decide whether a released drag commits to an answer.
 * Pure + worklet-safe so it can run on the UI thread.
 */
export function resolveSwipe(
  translationX: number,
  velocityX: number,
  containerWidth: number,
  config: SwipeConfig = SWIPE,
): SwipeDirection | null {
  'worklet';
  const threshold = containerWidth * config.thresholdRatio;
  if (translationX <= -threshold) return 'left';
  if (translationX >= threshold) return 'right';
  const isFling = Math.abs(velocityX) >= config.velocityThreshold;
  const farEnough = Math.abs(translationX) >= config.minFlingDistance;
  // A fling only counts when it moves in the same direction as the drag.
  if (isFling && farEnough && Math.sign(velocityX) === Math.sign(translationX)) {
    return translationX < 0 ? 'left' : 'right';
  }
  return null;
}

/** 0..1 progress towards the commit threshold (used for overlay opacity). */
export function swipeProgress(translationX: number, containerWidth: number, config: SwipeConfig = SWIPE): number {
  'worklet';
  const threshold = containerWidth * config.thresholdRatio;
  if (threshold <= 0) return 0;
  return Math.min(1, Math.abs(translationX) / threshold);
}
