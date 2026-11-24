import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import { CategoryLabel } from '@/components/game/CategoryLabel';
import { AppText, Banner, Button, EmptyState, Icon, ProgressBar, Screen, SectionHeader, Skeleton, StatTile, Surface } from '@/components/ui';
import { withAlpha } from '@/config/theme.config';
import { SESSION } from '@/core';
import {
  accuracyTrend,
  formatPercent,
  improvement,
  overallAccuracy,
  recommendedTopics,
  strongestTopics,
  topicInsights,
  weakestTopics,
  type TopicInsight,
} from '@/features/analytics/insights';
import { startGame } from '@/features/gameplay/navigation';
import { useTheme } from '@/hooks/use-theme';
import { useStatsStore } from '@/stores/stats-store';

function TopicList({ items, empty }: { items: TopicInsight[]; empty: string }) {
  if (items.length === 0) {
    return (
      <AppText variant="small" tone="muted">
        {empty}
      </AppText>
    );
  }
  return (
    <View className="gap-2">
      {items.map((i) => (
        <View key={i.category.id} className="flex-row items-center justify-between">
          <CategoryLabel categoryId={i.category.id} size="sm" />
          <AppText variant="caption" tone="muted">
            {i.reliable ? `${formatPercent(i.accuracy)} · ${i.answered} answered` : `${i.answered} answered`}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export default function Progress() {
  const { colors } = useTheme();
  const stats = useStatsStore((s) => s.stats);
  const categories = useStatsStore((s) => s.categories);
  const loading = useStatsStore((s) => s.loading);
  const error = useStatsStore((s) => s.error);
  const refresh = useStatsStore((s) => s.refresh);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const insights = useMemo(() => (stats ? topicInsights(categories, stats.topicStats) : []), [stats, categories]);
  const trend = useMemo(() => (stats ? accuracyTrend(stats.recentSessions) : []), [stats]);
  const delta = improvement(trend);

  if (!stats) {
    return (
      <Screen>
        <AppText variant="title" className="pt-2">
          Your progress
        </AppText>
        {error ? (
          <Banner tone="error" actionLabel="Retry" onAction={refresh}>
            {error}
          </Banner>
        ) : (
          <>
            <Skeleton height={96} radius={20} />
            <Skeleton height={180} radius={20} />
            <Skeleton height={260} radius={20} />
          </>
        )}
      </Screen>
    );
  }

  if (stats.totalAnswered === 0) {
    return (
      <Screen>
        <AppText variant="title" className="pt-2">
          Your progress
        </AppText>
        <EmptyState
          icon="stats-chart"
          title="No progress yet"
          message="Play a session and your accuracy, streaks and topic strengths will appear here."
          actionLabel="Play Classic"
          onAction={() => startGame('classic')}
        />
      </Screen>
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <AppText variant="title" className="pt-2" accessibilityRole="header">
        Your progress
      </AppText>

      <View className="flex-row gap-3">
        <StatTile label="Answered" value={stats.totalAnswered} icon="albums" color={colors.accent2} />
        <StatTile label="Accuracy" value={formatPercent(overallAccuracy(stats))} icon="analytics" />
      </View>
      <View className="flex-row gap-3">
        <StatTile label="Highest streak" value={stats.highestStreak} icon="flame" color={colors.streak} />
        <StatTile label="Sessions" value={stats.sessionsCompleted} icon="checkmark-done" color={colors.ethical} />
      </View>

      <SectionHeader title="Improvement over time" />
      <Surface className="gap-3">
        {trend.length < 2 ? (
          <AppText variant="small" tone="muted">
            Finish a few more sessions to see your trend.
          </AppText>
        ) : (
          <>
            <View className="flex-row items-center justify-between">
              <AppText variant="bodyStrong">Accuracy per session</AppText>
              {delta !== null ? (
                <View className="flex-row items-center gap-1">
                  <Icon name={delta >= 0 ? 'trending-up' : 'trending-down'} size={16} color={delta >= 0 ? colors.ethical : colors.unethical} />
                  <AppText variant="caption" tone={delta >= 0 ? 'ethical' : 'unethical'}>
                    {delta >= 0 ? '+' : ''}
                    {delta} pts
                  </AppText>
                </View>
              ) : null}
            </View>
            <View
              className="flex-row items-end gap-1.5"
              style={{ height: 120 }}
              accessible
              accessibilityLabel={`Accuracy of last ${trend.length} sessions: ${trend.map((t) => `${Math.round(t.accuracy * 100)}%`).join(', ')}`}
            >
              {trend.map((t) => (
                <View key={t.id} className="flex-1 items-center justify-end gap-1" style={{ height: '100%' }}>
                  <View
                    style={{
                      width: '100%',
                      height: `${Math.max(4, t.accuracy * 100)}%`,
                      borderRadius: 6,
                      backgroundColor: t.accuracy >= 0.7 ? colors.ethical : t.accuracy >= 0.5 ? colors.streak : withAlpha(colors.unethical, 0.85),
                    }}
                  />
                </View>
              ))}
            </View>
            <View className="flex-row justify-between">
              <AppText variant="caption" tone="muted">
                Older
              </AppText>
              <AppText variant="caption" tone="muted">
                Latest
              </AppText>
            </View>
          </>
        )}
      </Surface>

      <SectionHeader title="Performance by category" />
      <Surface className="gap-4">
        {insights.map((i) => (
          <View key={i.category.id} className="gap-1.5">
            <View className="flex-row items-center justify-between gap-2">
              <CategoryLabel categoryId={i.category.id} size="sm" />
              <View className="flex-row items-center gap-1.5">
                {i.mastered ? <Icon name="ribbon" size={14} color={colors.streak} /> : null}
                <AppText variant="caption" tone="muted">
                  {i.answered === 0 ? 'Not practised' : i.reliable ? `${formatPercent(i.accuracy)} (${i.answered})` : `${i.answered} answered`}
                </AppText>
              </View>
            </View>
            <ProgressBar value={i.reliable ? (i.accuracy ?? 0) : 0} color={i.category.color} height={6} />
          </View>
        ))}
        <AppText variant="caption" tone="muted">
          Accuracy shows after {SESSION.minAnswersForTopicInsight} answers in a topic. A ribbon marks mastery ({SESSION.masteryMinAnswers}+ answers at{' '}
          {Math.round(SESSION.masteryAccuracy * 100)}%+).
        </AppText>
      </Surface>

      <SectionHeader title="Strongest topics" />
      <Surface>
        <TopicList items={strongestTopics(insights)} empty="Keep playing — strengths appear once you have answered a few in each topic." />
      </Surface>

      <SectionHeader title="Needs practice" />
      <Surface>
        <TopicList items={weakestTopics(insights)} empty="No weak spots detected yet. Nice!" />
      </Surface>

      <SectionHeader title="Recommended next" />
      <Surface className="gap-3">
        <TopicList items={recommendedTopics(insights)} empty="You have practised every topic. Try Endless mode!" />
        <Button label="Practise with Smart Review" icon="refresh-circle" variant="secondary" onPress={() => startGame('review')} />
      </Surface>
    </Screen>
  );
}
