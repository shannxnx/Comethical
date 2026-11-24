import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useEffect } from 'react';

import { GAME_MODES, answeredCount, type SessionProgress } from '@/core';
import { withAlpha } from '@/config/theme.config';
import { useTheme } from '@/hooks/use-theme';
import { AppText } from '../ui/AppText';
import { Icon } from '../ui/Icon';
import { ProgressBar } from '../ui/ProgressBar';
import { DifficultyBadge } from './DifficultyBadge';

export interface GameHeaderProps {
  progress: SessionProgress;
  plannedLength: number | null;
  onExit: () => void;
  onEnd?: () => void;
  /** True while feedback for the last answer is showing (the counter should not advance yet). */
  showingFeedback?: boolean;
}

function Pill({ icon, value, color, label }: { icon: 'flame' | 'star'; value: number; color: string; label: string }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (value > 0) scale.value = withSequence(withSpring(1.18, { damping: 8 }), withSpring(1, { damping: 12 }));
  }, [value, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[{ backgroundColor: withAlpha(color, 0.14), flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }, style]}
    >
      <Icon name={icon} size={15} color={color} />
      <AppText variant="caption" style={{ color }}>
        {value.toLocaleString()}
      </AppText>
    </Animated.View>
  );
}

export function GameHeader({ progress, plannedLength, onExit, onEnd, showingFeedback = false }: GameHeaderProps) {
  const { colors } = useTheme();
  const answered = answeredCount(progress);
  const mode = GAME_MODES[progress.mode];

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pause and leave session"
          onPress={onExit}
          hitSlop={8}
          className="items-center justify-center rounded-xl bg-card"
          style={{ width: 44, height: 44 }}
        >
          <Icon name="pause" size={20} color={colors.text} />
        </Pressable>
        <View className="flex-1">
          <AppText variant="caption" tone="muted">
            {mode.title}
            {plannedLength ? ` · ${Math.max(1, Math.min(answered + (showingFeedback ? 0 : 1), plannedLength))} of ${plannedLength}` : ` · ${answered} answered`}
          </AppText>
        </View>
        <Pill icon="flame" value={progress.streak} color={colors.streak} label="Current streak" />
        <Pill icon="star" value={progress.score} color={colors.accent} label="Score" />
      </View>
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          {plannedLength ? (
            <ProgressBar value={answered / plannedLength} height={6} accessibilityLabel="Session progress" />
          ) : (
            <AppText variant="small" tone="muted">
              Best streak this run: {progress.bestStreak}
            </AppText>
          )}
        </View>
        <DifficultyBadge difficulty={progress.difficulty} />
        {onEnd ? (
          <Pressable accessibilityRole="button" onPress={onEnd} hitSlop={10} style={{ minHeight: 36, justifyContent: 'center' }}>
            <AppText variant="caption" tone="accent">
              End
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
