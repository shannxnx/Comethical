import { View } from 'react-native';

import { getDifficultyTier } from '@/core';
import { withAlpha } from '@/config/theme.config';
import { useTheme } from '@/hooks/use-theme';
import { AppText } from '../ui/AppText';

const TIER_COLORS = ['#22C55E', '#38BDF8', '#A78BFA', '#F59E0B', '#EF4444'];

/** Difficulty shown as tier name + 5 pips (text + shape, not colour alone). */
export function DifficultyBadge({ difficulty, compact = false }: { difficulty: number; compact?: boolean }) {
  const { colors } = useTheme();
  const tier = getDifficultyTier(difficulty);
  const tierIndex = Math.min(4, Math.floor((tier.min - 1) / 2));
  const tint = TIER_COLORS[tierIndex] ?? colors.accent;
  return (
    <View
      accessible
      accessibilityLabel={`Difficulty ${difficulty} of 10, ${tier.label}`}
      className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ backgroundColor: withAlpha(tint, 0.14) }}
    >
      <View className="flex-row gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{ width: 4, height: 10, borderRadius: 2, backgroundColor: i <= tierIndex ? tint : withAlpha(tint, 0.25) }}
          />
        ))}
      </View>
      {!compact ? (
        <AppText variant="caption" style={{ color: tint }}>
          {tier.label}
        </AppText>
      ) : null}
    </View>
  );
}
