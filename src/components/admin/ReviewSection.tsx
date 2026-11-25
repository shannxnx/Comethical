import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { AppText, Button, Chip, Skeleton } from '@/components/ui';
import type { ReviewFilter } from '@/features/admin/types';
import { useAdminStore } from '@/stores/admin-store';
import { AdminScenarioCard } from './AdminScenarioCard';

const FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: 'pending', label: 'Drafts' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'rejected', label: 'Rejected' },
];

/** Scenarios waiting for a decision. Approving sends them straight into games. */
export function ReviewSection() {
  const s = useAdminStore();
  const count = (f: ReviewFilter) => (!s.stats ? null : f === 'pending' ? s.stats.drafts : f === 'flagged' ? s.stats.flagged : s.stats.rejected);

  return (
    <View className="gap-3">
      <AppText variant="small" tone="muted">
        AI-generated scenarios wait here. Approve one to put it into games, or edit it first. Flagged ones were marked ambiguous by the AI reviewer.
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {FILTERS.map((f) => {
          const n = count(f.value);
          return <Chip key={f.value} label={n === null ? f.label : `${f.label} (${n})`} selected={s.reviewFilter === f.value} onPress={() => s.setReviewFilter(f.value)} />;
        })}
      </ScrollView>

      {s.reviewLoading && s.reviewItems.length === 0 ? (
        <>
          <Skeleton height={220} radius={20} />
          <Skeleton height={220} radius={20} />
        </>
      ) : s.reviewItems.length === 0 ? (
        <View className="items-center gap-3 py-6">
          <AppText tone="muted" variant="small" className="text-center">
            {s.reviewFilter === 'pending' ? 'No drafts waiting. Generate some new scenarios.' : 'Nothing here.'}
          </AppText>
          {s.reviewFilter === 'pending' ? <Button label="Open generator" icon="sparkles" variant="secondary" fullWidth={false} onPress={() => s.setSection('generate')} /> : null}
        </View>
      ) : (
        s.reviewItems.map((item) => (
          <AdminScenarioCard
            key={item.id}
            scenario={item}
            busy={!!s.busy[item.id]}
            onApprove={() => void s.setStatus(item.id, 'approved')}
            onUnpublish={() => void s.setStatus(item.id, 'pending')}
            onReject={() => void s.setStatus(item.id, 'rejected')}
            onDelete={() => void s.remove(item.id)}
            onReassess={() => void s.reassess(item.id)}
            onEdit={() => router.push({ pathname: '/admin/[id]', params: { id: item.id } })}
          />
        ))
      )}
    </View>
  );
}
