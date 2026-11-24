import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ExplanationBody } from '@/components/feedback/ExplanationBody';
import { CategoryLabel } from '@/components/game/CategoryLabel';
import { DifficultyBadge } from '@/components/game/DifficultyBadge';
import { AppText, Banner, Button, Chip, EmptyState, Icon, Screen, SegmentedControl, Skeleton, Surface } from '@/components/ui';
import { DIFFICULTY_TIERS, getTierId, type DifficultyTierId } from '@/core';
import { startGame } from '@/features/gameplay/navigation';
import { useTheme } from '@/hooks/use-theme';
import { getRepository } from '@/services/repository';
import { useStatsStore } from '@/stores/stats-store';
import type { ReviewItem } from '@/types/game';
import { toAppError } from '@/utils/errors';

type StatusFilter = 'pending' | 'reviewed' | 'all';

function ReviewCard({ item, onRetry, onMarkReviewed }: { item: ReviewItem; onRetry: () => void; onMarkReviewed: () => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Surface className="gap-3">
      <View className="flex-row items-center justify-between gap-2">
        <CategoryLabel categoryId={item.scenario.categoryId} size="sm" />
        <DifficultyBadge difficulty={item.scenario.difficulty} compact />
      </View>
      <AppText variant="bodyStrong">{item.scenario.text}</AppText>
      <View className="flex-row flex-wrap items-center gap-2">
        {item.reviewed ? (
          <Chip label="Reviewed" icon="checkmark-done" color={colors.ethical} />
        ) : (
          <Chip label={item.timesMissed > 1 ? `Missed ${item.timesMissed}×` : 'Missed'} icon="alert-circle" color={colors.streak} />
        )}
        <AppText variant="caption" tone="muted">
          {new Date(item.lastMissedAt).toLocaleDateString()}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        className="flex-row items-center gap-1"
        style={{ minHeight: 36 }}
      >
        <AppText variant="caption" tone="accent">
          {open ? 'Hide explanation' : 'Show explanation'}
        </AppText>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.accent} />
      </Pressable>
      {open ? <ExplanationBody explanation={item.explanation} selected={item.selected} /> : null}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button label="Retry" icon="refresh" variant="secondary" onPress={onRetry} />
        </View>
        {!item.reviewed ? (
          <View className="flex-1">
            <Button label="Mark reviewed" icon="checkmark" variant="ghost" onPress={onMarkReviewed} />
          </View>
        ) : null}
      </View>
    </Surface>
  );
}

export default function Review() {
  const categories = useStatsStore((s) => s.categories);
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [category, setCategory] = useState<string | null>(null);
  const [tier, setTier] = useState<DifficultyTierId | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setItems(await getRepository().getReviewItems());
      setError(null);
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = useMemo(
    () =>
      (items ?? []).filter(
        (i) =>
          (status === 'all' || (status === 'pending' ? !i.reviewed : i.reviewed)) &&
          (!category || i.scenario.categoryId === category) &&
          (!tier || getTierId(i.scenario.difficulty) === tier),
      ),
    [items, status, category, tier],
  );
  const pendingIds = (items ?? []).filter((i) => !i.reviewed).map((i) => i.scenario.id);
  const usedCategories = categories.filter((c) => (items ?? []).some((i) => i.scenario.categoryId === c.id));

  const markReviewed = async (id: string) => {
    setItems((prev) => prev?.map((i) => (i.scenario.id === id ? { ...i, reviewed: true, reviewedAt: Date.now() } : i)) ?? prev);
    try {
      await getRepository().markReviewed(id);
    } catch (e) {
      setError(toAppError(e).message);
      void load();
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={load}>
      <View className="gap-1 pt-2">
        <AppText variant="title" accessibilityRole="header">
          Review
        </AppText>
        <AppText tone="muted" variant="small">
          Revisit scenarios you missed. Answer them correctly in Smart Review to mark them reviewed.
        </AppText>
      </View>

      {error ? (
        <Banner tone="error" actionLabel="Retry" onAction={load}>
          {error}
        </Banner>
      ) : null}

      {items === null && !error ? (
        <>
          <Skeleton height={44} radius={12} />
          <Skeleton height={160} radius={20} />
          <Skeleton height={160} radius={20} />
        </>
      ) : items && items.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="Nothing to review yet"
          message="Scenarios you answer incorrectly will appear here with their explanations."
          actionLabel="Play Classic"
          onAction={() => startGame('classic')}
        />
      ) : items ? (
        <>
          {pendingIds.length > 0 ? (
            <Button label={`Retry all ${pendingIds.length} in Smart Review`} icon="play" onPress={() => startGame('review', pendingIds.slice(0, 20))} />
          ) : null}

          <SegmentedControl
            accessibilityLabel="Filter by review status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'pending', label: `To review (${pendingIds.length})` },
              { value: 'reviewed', label: 'Reviewed' },
              { value: 'all', label: 'All' },
            ]}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2" accessibilityLabel="Filter by category">
            <Chip label="All topics" selected={category === null} onPress={() => setCategory(null)} />
            {usedCategories.map((c) => (
              <Chip key={c.id} label={c.name} icon={c.icon} color={c.color} selected={category === c.id} onPress={() => setCategory(category === c.id ? null : c.id)} />
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2" accessibilityLabel="Filter by difficulty">
            <Chip label="Any difficulty" selected={tier === null} onPress={() => setTier(null)} />
            {DIFFICULTY_TIERS.map((t) => (
              <Chip key={t.id} label={t.label} selected={tier === t.id} onPress={() => setTier(tier === t.id ? null : t.id)} />
            ))}
          </ScrollView>

          {filtered.length === 0 ? (
            <AppText tone="muted" variant="small" className="py-6 text-center">
              No scenarios match these filters.
            </AppText>
          ) : (
            filtered.map((item) => (
              <ReviewCard
                key={item.scenario.id}
                item={item}
                onRetry={() => startGame('review', [item.scenario.id])}
                onMarkReviewed={() => void markReviewed(item.scenario.id)}
              />
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}
