import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';

import { AdminScenarioCard } from '@/components/admin/AdminScenarioCard';
import { AppText, Banner, Button, Chip, EmptyState, Icon, Screen, SectionHeader, Skeleton, StatTile, Surface, TextField } from '@/components/ui';
import { DIFFICULTY_TIERS } from '@/core';
import { adminApi } from '@/features/admin/admin-api';
import type { AdminFilter } from '@/features/admin/types';
import { useTheme } from '@/hooks/use-theme';
import { useAdminStore } from '@/stores/admin-store';
import { useStatsStore } from '@/stores/stats-store';
import { toAppError } from '@/utils/errors';

const FILTERS: { value: AdminFilter; label: string }[] = [
  { value: 'pending', label: 'Drafts' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'approved', label: 'Live' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

export default function Admin() {
  const { colors } = useTheme();
  const isAdmin = useStatsStore((s) => s.stats?.isAdmin ?? false);
  const categories = useStatsStore((s) => s.categories);
  const store = useAdminStore();

  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? 'data-privacy');
  const [tierId, setTierId] = useState<string>('intermediate');
  const [count, setCount] = useState(3);
  const [instructions, setInstructions] = useState('');
  const [exporting, setExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) void useAdminStore.getState().refresh();
    }, [isAdmin]),
  );

  if (!isAdmin) {
    return (
      <Screen>
        <EmptyState icon="lock-closed" title="Admins only" message="This area is for COMETHICAL administrators." />
      </Screen>
    );
  }

  const tier = DIFFICULTY_TIERS.find((t) => t.id === tierId) ?? DIFFICULTY_TIERS[2]!;
  const stats = store.stats;

  const onGenerate = async () => {
    const ok = await store.generate({ categoryId, difficultyMin: tier.min, difficultyMax: tier.max, count, instructions });
    if (ok) setInstructions('');
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const res = await adminApi.exportApproved();
      await Share.share({ title: 'COMETHICAL approved scenarios', message: JSON.stringify(res.scenarios, null, 2) });
    } catch (e) {
      useAdminStore.setState({ error: toAppError(e).message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen keyboard refreshing={store.loading} onRefresh={store.refresh}>
      <View className="gap-1 pt-2">
        <View className="flex-row items-center gap-2">
          <Icon name="shield-half" size={22} color={colors.accent} />
          <AppText variant="title" accessibilityRole="header">
            Admin
          </AppText>
        </View>
        <AppText variant="small" tone="muted">
          Generate scenarios with Gemini, review them, and publish the good ones to players.
        </AppText>
      </View>

      <View className="flex-row gap-3">
        <StatTile label="Total scenarios" value={stats?.total ?? '—'} icon="albums" color={colors.accent2} />
        <StatTile label="Drafts" value={stats ? stats.drafts + stats.flagged : '—'} icon="document-text" color={colors.streak} />
      </View>
      <View className="flex-row gap-3">
        <StatTile label="Live" value={stats?.approved ?? '—'} icon="checkmark-done" color={colors.ethical} />
        <StatTile label="Avg difficulty" value={stats ? `${stats.averageDifficulty}/10` : '—'} icon="speedometer" />
      </View>

      {/* ── Generator ─────────────────────────────────────────────── */}
      <Surface className="gap-4">
        <View className="flex-row items-center gap-2">
          <Icon name="sparkles" size={20} color={colors.accent} />
          <AppText variant="heading">AI scenario generator</AppText>
        </View>

        <View className="gap-2">
          <AppText variant="caption" tone="muted">
            Category
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {categories.map((c) => (
              <Chip key={c.id} label={c.name} icon={c.icon} color={c.color} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
            ))}
          </ScrollView>
        </View>

        <View className="gap-2">
          <AppText variant="caption" tone="muted">
            Target difficulty ({tier.min}–{tier.max} of 10)
          </AppText>
          <View className="flex-row flex-wrap gap-2">
            {DIFFICULTY_TIERS.map((t) => (
              <Chip key={t.id} label={t.label} selected={tierId === t.id} onPress={() => setTierId(t.id)} />
            ))}
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <AppText variant="caption" tone="muted">
            Number of scenarios
          </AppText>
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fewer"
              onPress={() => setCount((c) => Math.max(1, c - 1))}
              className="items-center justify-center rounded-lg bg-surface"
              style={{ width: 40, height: 40 }}
            >
              <Icon name="remove" size={18} color={colors.text} />
            </Pressable>
            <AppText variant="heading" accessibilityLabel={`${count} scenarios`}>
              {count}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More"
              onPress={() => setCount((c) => Math.min(5, c + 1))}
              className="items-center justify-center rounded-lg bg-surface"
              style={{ width: 40, height: 40 }}
            >
              <Icon name="add" size={18} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <TextField
          label="Your idea / instructions"
          value={instructions}
          onChangeText={setInstructions}
          placeholder="e.g. A student uses an AI tool to write a scholarship essay; focus on honesty and fairness to other applicants."
          multiline
          maxLength={1000}
          style={{ color: colors.text, fontSize: 16, minHeight: 96, textAlignVertical: 'top', paddingVertical: 12, flex: 1 }}
        />

        <Button
          label={store.generating ? 'Gemini is writing…' : `Generate ${count} scenario${count > 1 ? 's' : ''}`}
          icon="sparkles"
          loading={store.generating}
          onPress={onGenerate}
        />
        <AppText variant="caption" tone="muted">
          Gemini expands your idea into complete flashcards, then a second AI pass scores difficulty and flags anything ambiguous. Nothing reaches
          players until you approve it.
        </AppText>
      </Surface>

      {store.error ? (
        <Banner tone="error" actionLabel="OK" onAction={store.clearMessages}>
          {store.error}
        </Banner>
      ) : null}
      {store.notice ? (
        <Banner tone="info" icon="checkmark-circle" actionLabel="OK" onAction={store.clearMessages}>
          {store.notice}
        </Banner>
      ) : null}

      {/* ── Review queue ──────────────────────────────────────────── */}
      <SectionHeader title="Scenario review queue" action={exporting ? 'Exporting…' : 'Export live JSON'} onAction={exporting ? undefined : onExport} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {FILTERS.map((f) => {
          const n =
            !stats ? null : f.value === 'pending' ? stats.drafts : f.value === 'flagged' ? stats.flagged : f.value === 'approved' ? stats.approved : f.value === 'rejected' ? stats.rejected : stats.total;
          return <Chip key={f.value} label={n === null ? f.label : `${f.label} (${n})`} selected={store.filter === f.value} onPress={() => store.setFilter(f.value)} />;
        })}
      </ScrollView>

      {store.loading && store.scenarios.length === 0 ? (
        <>
          <Skeleton height={180} radius={20} />
          <Skeleton height={180} radius={20} />
        </>
      ) : store.scenarios.length === 0 ? (
        <AppText tone="muted" variant="small" className="py-6 text-center">
          Nothing here. {store.filter === 'pending' ? 'Generate some scenarios above.' : ''}
        </AppText>
      ) : (
        store.scenarios.map((s) => (
          <AdminScenarioCard
            key={s.id}
            scenario={s}
            busy={!!store.busy[s.id]}
            onApprove={() => void store.setStatus(s.id, 'approved')}
            onUnpublish={() => void store.setStatus(s.id, 'pending')}
            onReject={() => void store.setStatus(s.id, 'rejected')}
            onDelete={() => void store.remove(s.id)}
            onReassess={() => void store.reassess(s.id)}
            onEdit={() => router.push({ pathname: '/admin/[id]', params: { id: s.id } })}
          />
        ))
      )}
    </Screen>
  );
}
