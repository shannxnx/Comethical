import { forwardRef, useCallback, useEffect, useImperativeHandle } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SWIPE, resolveSwipe, type PublicScenario, type SwipeDirection } from '@/core';
import { DURATIONS, SNAP_BACK_SPRING, withAlpha } from '@/config/theme.config';
import { useTheme } from '@/hooks/use-theme';
import { feedback } from '@/services/feedback';
import { AppText } from '../ui/AppText';
import { Icon } from '../ui/Icon';
import { CategoryLabel } from './CategoryLabel';
import { DifficultyBadge } from './DifficultyBadge';

export interface SwipeCardHandle {
  /** Programmatic swipe (answer buttons). Ignored while a swipe is already in flight. */
  swipe: (direction: SwipeDirection) => void;
}

export interface SwipeCardProps {
  scenario: PublicScenario;
  enabled: boolean;
  onSwipe: (direction: SwipeDirection) => void;
  /** Hint arrows/labels under the prompt (onboarding uses them). */
  showHints?: boolean;
}

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  { scenario, enabled, onSwipe, showHints = true },
  ref,
) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const width = useSharedValue(Math.min(windowWidth - 32, 520));
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const flying = useSharedValue(false);
  const crossed = useSharedValue(0); // -1 left, 0 none, 1 right
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withSpring(1, { damping: 18, stiffness: 160 });
  }, [enter]);

  const commit = useCallback((direction: SwipeDirection) => onSwipe(direction), [onSwipe]);

  const flyOut = (direction: SwipeDirection, velocity = 0) => {
    'worklet';
    if (flying.value) return;
    flying.value = true;
    const target = (direction === 'left' ? -1 : 1) * width.value * 1.6;
    scheduleOnRN(commit, direction);
    tx.value = withTiming(target, { duration: Math.max(140, DURATIONS.swipeOut - Math.abs(velocity) / 20) });
    ty.value = withTiming(ty.value + 40, { duration: DURATIONS.swipeOut });
  };

  useImperativeHandle(ref, () => ({
    swipe: (direction) => {
      // Runs on the JS thread (button press), so it commits directly instead of via scheduleOnRN.
      if (!enabled || flying.value) return;
      flying.value = true;
      commit(direction);
      tx.value = withTiming((direction === 'left' ? -1 : 1) * width.value * 1.6, { duration: DURATIONS.swipeOut });
      ty.value = withTiming(40, { duration: DURATIONS.swipeOut });
    },
  }));

  const pan = usePanGesture({
    enabled,
    activeOffsetX: [-8, 8],
    onUpdate: (e) => {
      'worklet';
      if (flying.value) return;
      tx.value = e.translationX;
      ty.value = e.translationY * 0.15;
      const threshold = width.value * SWIPE.thresholdRatio;
      const zone = e.translationX <= -threshold ? -1 : e.translationX >= threshold ? 1 : 0;
      if (zone !== crossed.value) {
        crossed.value = zone;
        if (zone !== 0) scheduleOnRN(feedback.thresholdTick);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      if (flying.value) return;
      const direction = resolveSwipe(e.translationX, e.velocityX, width.value);
      crossed.value = 0;
      if (direction) {
        flyOut(direction, e.velocityX);
      } else {
        // Cancelled swipe: spring back to the centre.
        tx.value = withSpring(0, SNAP_BACK_SPRING);
        ty.value = withSpring(0, SNAP_BACK_SPRING);
      }
    },
  });

  const cardStyle = useAnimatedStyle(() => {
    const threshold = width.value * SWIPE.thresholdRatio;
    const rotate = interpolate(tx.value, [-threshold, 0, threshold], [-SWIPE.maxRotationDeg, 0, SWIPE.maxRotationDeg]);
    return {
      opacity: enter.value,
      borderColor: interpolateColor(tx.value, [-threshold, 0, threshold], [colors.ethical, colors.border, colors.unethical]),
      transform: [
        { translateX: tx.value },
        { translateY: ty.value + (1 - enter.value) * 24 },
        { rotate: `${rotate}deg` },
        { scale: 0.94 + enter.value * 0.06 },
      ],
    };
  });

  // Computed on the JS thread; worklets can only capture plain values.
  const ethicalTint = withAlpha(colors.ethical, 0.16);
  const neutralTint = withAlpha(colors.ethical, 0);
  const unethicalTint = withAlpha(colors.unethical, 0.16);
  const tintStyle = useAnimatedStyle(() => {
    const threshold = width.value * SWIPE.thresholdRatio;
    return {
      backgroundColor: interpolateColor(
        tx.value,
        [-threshold, 0, threshold],
        [ethicalTint, neutralTint, unethicalTint],
      ),
    };
  });

  const ethicalLabel = useAnimatedStyle(() => ({
    opacity: interpolate(-tx.value, [10, width.value * SWIPE.thresholdRatio], [0, 1], Extrapolation.CLAMP),
  }));
  const unethicalLabel = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [10, width.value * SWIPE.thresholdRatio], [0, 1], Extrapolation.CLAMP),
  }));

  const long = scenario.text.length > 220;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Scenario. ${scenario.text}`}
        accessibilityHint="Swipe left if the action is ethical, right if it is unethical. Or use the buttons below."
        onLayout={(e) => {
          width.value = e.nativeEvent.layout.width;
        }}
        style={[styles.card, { backgroundColor: colors.card, shadowColor: '#000' }, cardStyle]}
      >
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 26 }, tintStyle]} />

        <View className="flex-row items-center justify-between gap-2">
          <CategoryLabel categoryId={scenario.categoryId} />
          <DifficultyBadge difficulty={scenario.difficulty} />
        </View>

        <View className="flex-1 justify-center py-4">
          <AppText
            variant="body"
            style={{ fontSize: long ? 17 : 20, lineHeight: long ? 26 : 30, fontWeight: '600' }}
            maxFontSizeMultiplier={1.3}
          >
            {scenario.text}
          </AppText>
        </View>

        <View className="gap-3">
          <View className="h-px bg-border" />
          <AppText variant="bodyStrong" tone="muted" className="text-center">
            Is this action ethical?
          </AppText>
          {showHints ? (
            <View className="flex-row justify-between">
              <View className="flex-row items-center gap-1">
                <Icon name="arrow-back" size={14} color={colors.ethical} />
                <AppText variant="caption" tone="ethical">
                  Ethical
                </AppText>
              </View>
              <View className="flex-row items-center gap-1">
                <AppText variant="caption" tone="unethical">
                  Unethical
                </AppText>
                <Icon name="arrow-forward" size={14} color={colors.unethical} />
              </View>
            </View>
          ) : null}
        </View>

        {/* Overlay stamps — icon + text + colour, never colour alone. */}
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampRight, { borderColor: colors.ethical }, ethicalLabel]}>
          <Icon name="checkmark-circle" size={22} color={colors.ethical} />
          <AppText variant="heading" tone="ethical">
            ETHICAL
          </AppText>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampLeft, { borderColor: colors.unethical }, unethicalLabel]}>
          <Icon name="close-circle" size={22} color={colors.unethical} />
          <AppText variant="heading" tone="unethical">
            UNETHICAL
          </AppText>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 26,
    borderWidth: 2,
    padding: 20,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  stamp: {
    position: 'absolute',
    top: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 3,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stampRight: { right: 18, transform: [{ rotate: '10deg' }] },
  stampLeft: { left: 18, transform: [{ rotate: '-10deg' }] },
});
