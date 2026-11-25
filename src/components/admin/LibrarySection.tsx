import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText, Button, Chip, Skeleton, TextField } from '@/components/ui';
import { DIFFICULTY_TIERS } from '@/core';
import { DEFAULT_LIBRARY_FILTERS, type Visibility } from '@/features/admin/types';
import { useAdminStore } from '@/stores/admin-store';
import { useStatsStore } from '@/stores/stats-store';
import { LibraryCard } from './LibraryCard';

const VISIBILITY: { value: Visibility; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_game', label: 'In game' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'not_approved', label: 'Not approved' },
];

export function LibrarySection() {
  const categories = useStatsStore((s) => s.categories);
  const s = useAdminStore();
  const [search, setSearch] = useState(s.filters.search);

  // Debounce typing so every keystroke doesn't hit the server.
  useEffect(() => {
    if (search === useAdminStore.getState().filters.search) return;
    const t = setTimeout(() => useAdminStore.getState().setFilters({ search }), 400);
    return () => clearTimeout(t);
  }, [search]);

  const f = s.filters;
  const filtered =
    f.search !== DEFAULT_LIBRARY_FILTERS.search ||
    f.categoryId !== null ||
    f.tierId !== null ||
    f.source !== null ||
    f.visibility !== DEFAULT_LIBRARY_FILTERS.visibility;

  return (
    <View className="gap-3">
      <TextField
        label="Search scenarios"
        value={search}
        onChangeText={setSearch}
        placeholder="Type words from a scenario…"
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2" accessibilityLabel="Filter by visibility">
        {VISIBILITY.map((v) => (
          <Chip key={v.value} label={v.label} selected={f.visibility === v.value} onPress={() => s.setFilters({ visibility: v.value })} />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2" accessibilityLabel="Filter by category">
        <Chip label="All categories" selected={f.categoryId === null} onPress={() => s.setFilters({ categoryId: null })} />
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            icon={c.icon}
            color={c.color}
            selected={f.categoryId === c.id}
            onPress={() => s.setFilters({ categoryId: f.categoryId === c.id ? null : c.id })}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2" accessibilityLabel="Filter by difficulty and source">
        <Chip label="Any difficulty" selected={f.tierId === null} onPress={() => s.setFilters({ tierId: null })} />
        {DIFFICULTY_TIERS.map((t) => (
          <Chip key={t.id} label={t.label} selected={f.tierId === t.id} onPress={() => s.setFilters({ tierId: f.tierId === t.id ? null : t.id })} />
        ))}
        <Chip label="AI-generated" icon="sparkles" selected={f.source === 'ai'} onPress={() => s.setFilters({ source: f.source === 'ai' ? null : 'ai' })} />
        <Chip label="Hand-written" icon="create" selected={f.source === 'seed'} onPress={() => s.setFilters({ source: f.source === 'seed' ? null : 'seed' })} />
      </ScrollView>

      <View className="flex-row items-center justify-between">
        <AppText variant="caption" tone="muted">
          {s.libraryLoading ? 'Loading…' : `${s.libraryMatching} scenario${s.libraryMatching === 1 ? '' : 's'}`}
        </AppText>
        {filtered ? (
          <Chip
            label="Clear filters"
            icon="close"
            onPress={() => {
              setSearch('');
              s.resetFilters();
            }}
          />
        ) : null}
      </View>

      {s.libraryLoading && s.libraryItems.length === 0 ? (
        <>
          <Skeleton height={190} radius={20} />
          <Skeleton height={190} radius={20} />
        </>
      ) : s.libraryItems.length === 0 ? (
        <AppText tone="muted" variant="small" className="py-6 text-center">
          No scenarios match these filters.
        </AppText>
      ) : (
        s.libraryItems.map((item) => (
          <LibraryCard
            key={item.id}
            scenario={item}
            busy={!!s.busy[item.id]}
            onToggleInGame={(v) => void s.setInGame(item.id, v)}
            onApprove={() => void s.setStatus(item.id, 'approved')}
            onUnpublish={() => void s.setStatus(item.id, 'pending')}
            onReject={() => void s.setStatus(item.id, 'rejected')}
            onDelete={() => void s.remove(item.id)}
            onReassess={() => void s.reassess(item.id)}
            onEdit={() => router.push({ pathname: '/admin/[id]', params: { id: item.id } })}
          />
        ))
      )}

      {s.libraryItems.length < s.libraryMatching ? (
        <Button
          label={`Load more (${s.libraryMatching - s.libraryItems.length} left)`}
          variant="secondary"
          loading={s.libraryLoadingMore}
          onPress={() => void s.loadMoreLibrary()}
        />
      ) : null}
    </View>
  );
}
