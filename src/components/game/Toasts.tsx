import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ZoomIn } from 'react-native-reanimated';

import { withAlpha } from '@/config/theme.config';
import { useTheme } from '@/hooks/use-theme';
import { AppText } from '../ui/AppText';
import { Icon } from '../ui/Icon';

const MILESTONE_TEXT: Record<number, string> = {
  5: 'On fire! 5 in a row',
  10: 'Unstoppable! 10 streak',
  20: 'Ethics ace! 20 streak',
  30: 'Legendary! 30 streak',
};

/** Small, non-blocking toast at the top of the play area. */
function useAutoHide(key: number | undefined, ms: number) {
  const [hiddenKey, setHiddenKey] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (key === undefined) return;
    const t = setTimeout(() => setHiddenKey(key), ms);
    return () => clearTimeout(t);
  }, [key, ms]);
  return key !== undefined && key !== hiddenKey;
}

export function MilestoneToast({ milestone }: { milestone: { value: number; key: number } | null }) {
  const { colors } = useTheme();
  const visible = useAutoHide(milestone?.key, 1800);
  if (!visible || !milestone) return null;
  return (
    <Animated.View
      entering={FadeInUp.springify().damping(14)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: 0, right: 0, top: 8, zIndex: 10, alignItems: 'center' }}
    >
      <View
        className="flex-row items-center gap-2 rounded-full px-4 py-2"
        style={{ backgroundColor: withAlpha(colors.streak, 0.18), borderWidth: 1, borderColor: colors.streak }}
      >
        <Icon name="flame" size={18} color={colors.streak} />
        <AppText variant="bodyStrong" tone="streak">
          {MILESTONE_TEXT[milestone.value] ?? `${milestone.value} in a row!`}
        </AppText>
      </View>
    </Animated.View>
  );
}

export function DifficultyToast({ notice }: { notice: { change: -1 | 1; key: number } | null }) {
  const { colors } = useTheme();
  const visible = useAutoHide(notice?.key, 1600);
  if (!visible || !notice) return null;
  const up = notice.change > 0;
  return (
    <Animated.View
      entering={FadeInUp.delay(150)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: 0, right: 0, top: 56, zIndex: 10, alignItems: 'center' }}
    >
      <View className="flex-row items-center gap-2 rounded-full bg-card px-3 py-1.5" style={{ borderWidth: 1, borderColor: colors.border }}>
        <Icon name={up ? 'trending-up' : 'trending-down'} size={16} color={up ? colors.accent : colors.accent2} />
        <AppText variant="caption" tone="muted">
          {up ? 'Difficulty up — nice work!' : 'Difficulty eased to help you build up'}
        </AppText>
      </View>
    </Animated.View>
  );
}

/** Positive feedback shown in place of the card after a correct answer. */
export function CorrectFeedback({ points, xp }: { points: number; xp: number }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={ZoomIn.springify().damping(12)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }} accessibilityLiveRegion="assertive">
      <View
        style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: withAlpha(colors.ethical, 0.16), borderWidth: 3, borderColor: colors.ethical }}
        className="items-center justify-center"
      >
        <Icon name="checkmark" size={56} color={colors.ethical} />
      </View>
      <AppText variant="title" tone="ethical">
        Correct!
      </AppText>
      <View className="flex-row gap-3">
        <AppText variant="bodyStrong" tone="accent">
          +{points} pts
        </AppText>
        <AppText variant="bodyStrong" tone="muted">
          +{xp} XP
        </AppText>
      </View>
    </Animated.View>
  );
}
