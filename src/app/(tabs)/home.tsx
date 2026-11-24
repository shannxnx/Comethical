import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { LevelCard } from '@/components/game/LevelCard';
import { ModeCard } from '@/components/game/ModeCard';
import { AppText, Avatar, Banner, Icon, SectionHeader, Skeleton, StatTile } from '@/components/ui';
import { Screen } from '@/components/ui/Screen';
import { GAME_MODES, getDifficultyTier } from '@/core';
import { formatPercent, overallAccuracy } from '@/features/analytics/insights';
import { startGame } from '@/features/gameplay/navigation';
import { useTheme } from '@/hooks/use-theme';
import { isDemoMode } from '@/services/repository';
import { useStatsStore } from '@/stores/stats-store';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { colors } = useTheme();
  const stats = useStatsStore((s) => s.stats);
  const loading = useStatsStore((s) => s.loading);
  const error = useStatsStore((s) => s.error);
  const refresh = useStatsStore((s) => s.refresh);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const recent = stats?.recentSessions.slice(0, 5) ?? [];

  return (
    <Screen refreshing={loading && !!stats} onRefresh={refresh}>
      <View className="flex-row items-center gap-3 pt-2">
        <Avatar name={stats?.username ?? 'Player'} size={48} />
        <View className="flex-1">
          <AppText variant="small" tone="muted">
            {greeting()}
          </AppText>
          {stats ? (
            <AppText variant="heading" numberOfLines={1}>
              {stats.username}
            </AppText>
          ) : (
            <Skeleton height={22} width="50%" />
          )}
        </View>
        {stats && stats.highestStreak > 0 ? (
          <View className="flex-row items-center gap-1 rounded-full bg-card px-3 py-1.5" accessibilityLabel={`Best streak ${stats.highestStreak}`}>
            <Icon name="flame" size={16} color={colors.streak} />
            <AppText variant="caption" tone="streak">
              {stats.highestStreak}
            </AppText>
          </View>
        ) : null}
      </View>

      {isDemoMode() ? (
        <Banner tone="demo" icon="flask">
          Local demo mode — progress is stored only on this device. Add Supabase keys to play online.
        </Banner>
      ) : null}
      {error ? <Banner tone="error" actionLabel="Retry" onAction={refresh}>{error}</Banner> : null}

      {stats ? <LevelCard totalXp={stats.totalXp} /> : <Skeleton height={124} radius={20} />}

      {/* Primary action */}
      <Pressable accessibilityRole="button" accessibilityLabel="Play Classic mode" onPress={() => startGame('classic')} className="active:opacity-90">
        <LinearGradient
          colors={[colors.accent, colors.accent2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 20, minHeight: 120, justifyContent: 'space-between' }}
        >
          <View className="flex-row items-start justify-between">
            <View className="gap-1">
              <AppText variant="overline" style={{ color: '#04201C', opacity: 0.75 }}>
                {stats ? `${getDifficultyTier(stats.currentDifficulty).label} · Level ${stats.currentDifficulty}/10` : 'Ready?'}
              </AppText>
              <AppText variant="title" style={{ color: '#04201C' }}>
                Play
              </AppText>
            </View>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(4,32,28,0.15)' }} className="items-center justify-center">
              <Icon name="play" size={30} color="#04201C" />
            </View>
          </View>
          <AppText variant="small" style={{ color: '#04201C', opacity: 0.8 }}>
            Classic · 20 scenarios that adapt to you
          </AppText>
        </LinearGradient>
      </Pressable>

      <SectionHeader title="Game modes" />
      <View className="gap-3">
        <ModeCard mode={GAME_MODES.classic} meta={stats?.bestScores.classic ? `Best score ${stats.bestScores.classic.toLocaleString()}` : undefined} onPress={() => startGame('classic')} />
        <ModeCard
          mode={GAME_MODES.endless}
          meta={stats?.bestStreaks.endless ? `Longest streak ${stats.bestStreaks.endless}` : undefined}
          onPress={() => startGame('endless')}
        />
        <ModeCard
          mode={GAME_MODES.review}
          badge={stats && stats.pendingReviewCount > 0 ? `${stats.pendingReviewCount} to review` : undefined}
          meta={stats && stats.pendingReviewCount === 0 ? 'Practice your weakest topics' : undefined}
          onPress={() => startGame('review')}
        />
      </View>

      <SectionHeader title="Your stats" action="See progress" onAction={() => router.push('/progress')} />
      <View className="flex-row gap-3">
        <StatTile label="Accuracy" value={stats ? formatPercent(overallAccuracy(stats)) : '—'} icon="analytics" />
        <StatTile label="Best streak" value={stats?.highestStreak ?? 0} icon="flame" color={colors.streak} />
        <StatTile label="Answered" value={stats?.totalAnswered ?? 0} icon="albums" color={colors.accent2} />
      </View>

      <SectionHeader title="Recent sessions" />
      {recent.length === 0 ? (
        <AppText tone="muted" variant="small">
          No sessions yet. Tap Play to start your first one.
        </AppText>
      ) : (
        <View className="gap-2">
          {recent.map((s) => {
            const answered = s.correct + s.incorrect;
            const acc = answered > 0 ? s.correct / answered : 0;
            return (
              <View key={s.id} className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                <Icon name={GAME_MODES[s.mode].icon} size={18} color={colors.muted} />
                <View className="flex-1">
                  <AppText variant="bodyStrong">{GAME_MODES[s.mode].title}</AppText>
                  <AppText variant="caption" tone="muted">
                    {s.correct}/{answered} correct · {new Date(s.completedAt).toLocaleDateString()}
                  </AppText>
                </View>
                <AppText variant="bodyStrong" tone={acc >= 0.7 ? 'ethical' : acc >= 0.5 ? 'streak' : 'unethical'}>
                  {Math.round(acc * 100)}%
                </AppText>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
