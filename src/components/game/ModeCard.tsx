import { Pressable, View } from 'react-native';

import type { GameModeDefinition } from '@/core';
import { withAlpha } from '@/config/theme.config';
import { useTheme } from '@/hooks/use-theme';
import { AppText } from '../ui/AppText';
import { Icon } from '../ui/Icon';

export function ModeCard({
  mode,
  meta,
  badge,
  onPress,
}: {
  mode: GameModeDefinition;
  meta?: string;
  badge?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const tint = mode.id === 'review' ? colors.streak : mode.id === 'endless' ? colors.accent2 : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${mode.title} mode. ${mode.tagline}. ${meta ?? ''}`}
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4 active:opacity-80"
      style={{ minHeight: 72 }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: withAlpha(tint, 0.15) }} className="items-center justify-center">
        <Icon name={mode.icon} size={24} color={tint} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <AppText variant="bodyStrong">{mode.title}</AppText>
          {badge ? (
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: withAlpha(tint, 0.18) }}>
              <AppText variant="caption" style={{ color: tint }}>
                {badge}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="small" tone="muted" numberOfLines={1}>
          {meta ?? mode.tagline}
        </AppText>
      </View>
      <Icon name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}
