import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { DURATIONS } from '@/config/theme.config';
import { useTheme } from '@/hooks/use-theme';

export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  color?: string;
  height?: number;
  accessibilityLabel?: string;
}

export function ProgressBar({ value, color, height = 8, accessibilityLabel }: ProgressBarProps) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

  useEffect(() => {
    progress.value = withTiming(clamped, { duration: DURATIONS.slow });
  }, [clamped, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ height, borderRadius: height, backgroundColor: colors.border, overflow: 'hidden' }}
    >
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: color ?? colors.accent }, fill]} />
    </View>
  );
}
