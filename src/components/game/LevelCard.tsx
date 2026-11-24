import { View } from 'react-native';

import { getLevelProgress } from '@/core';
import { withAlpha } from '@/config/theme.config';
import { useTheme } from '@/hooks/use-theme';
import { AppText } from '../ui/AppText';
import { Icon } from '../ui/Icon';
import { ProgressBar } from '../ui/ProgressBar';

export function LevelCard({ totalXp }: { totalXp: number }) {
  const { colors } = useTheme();
  const lp = getLevelProgress(totalXp);
  return (
    <View className="gap-3 rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-center gap-3">
        <View
          style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: withAlpha(colors.streak, 0.15) }}
          className="items-center justify-center"
        >
          <Icon name="medal" size={26} color={colors.streak} />
        </View>
        <View className="flex-1">
          <AppText variant="heading">{lp.rank.title}</AppText>
          <AppText variant="small" tone="muted">
            Level {lp.level} · {totalXp.toLocaleString()} XP total
          </AppText>
        </View>
      </View>
      <ProgressBar value={lp.progress} color={colors.streak} accessibilityLabel={`Progress to level ${lp.level + 1}`} />
      <View className="flex-row justify-between">
        <AppText variant="caption" tone="muted">
          {lp.xpIntoLevel} / {lp.xpForLevel} XP
        </AppText>
        <AppText variant="caption" tone="muted">
          {lp.nextRank ? `${lp.nextRank.title} at Lv ${lp.nextRank.minLevel}` : 'Top rank reached'}
        </AppText>
      </View>
    </View>
  );
}
