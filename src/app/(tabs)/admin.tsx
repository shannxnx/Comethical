import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, View } from 'react-native';

import { GeneratorPanel } from '@/components/admin/GeneratorPanel';
import { LibrarySection } from '@/components/admin/LibrarySection';
import { ReviewSection } from '@/components/admin/ReviewSection';
import { AppText, Banner, Chip, EmptyState, Icon, Screen, SegmentedControl, StatTile } from '@/components/ui';
import { adminApi } from '@/features/admin/admin-api';
import type { AdminSection } from '@/features/admin/types';
import { useTheme } from '@/hooks/use-theme';
import { useAdminStore } from '@/stores/admin-store';
import { useStatsStore } from '@/stores/stats-store';
import { toAppError } from '@/utils/errors';

export default function Admin() {
  const { colors } = useTheme();
  const isAdmin = useStatsStore((s) => s.stats?.isAdmin ?? false);
  const section = useAdminStore((s) => s.section);
  const stats = useAdminStore((s) => s.stats);
  const error = useAdminStore((s) => s.error);
  const notice = useAdminStore((s) => s.notice);
  const loading = useAdminStore((s) => s.reviewLoading || s.libraryLoading);
  const { setSection, refreshCurrent, clearMessages } = useAdminStore.getState();
  const [exporting, setExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) void useAdminStore.getState().refreshCurrent();
    }, [isAdmin]),
  );

  if (!isAdmin) {
    return (
      <Screen>
        <EmptyState icon="lock-closed" title="Admins only" message="This area is for COMETHICAL administrators." />
      </Screen>
    );
  }

  const awaiting = stats ? stats.drafts + stats.flagged : null;

  const onExport = async () => {
    setExporting(true);
    try {
      const res = await adminApi.exportApproved();
      await Share.share({ title: 'COMETHICAL scenarios in game', message: JSON.stringify(res.scenarios, null, 2) });
    } catch (e) {
      useAdminStore.setState({ error: toAppError(e).message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen keyboard refreshing={loading} onRefresh={refreshCurrent}>
      <View className="gap-1 pt-2">
        <View className="flex-row items-center gap-2">
          <Icon name="shield-half" size={22} color={colors.accent} />
          <AppText variant="title" accessibilityRole="header">
            Admin
          </AppText>
        </View>
        <AppText variant="small" tone="muted">
          Players only see scenarios that are approved and switched on.
        </AppText>
      </View>

      <View className="flex-row gap-3">
        <StatTile label="In game" value={stats?.live ?? '—'} icon="game-controller" color={colors.ethical} />
        <StatTile label="Awaiting review" value={awaiting ?? '—'} icon="hourglass" color={colors.streak} />
      </View>
      <View className="flex-row gap-3">
        <StatTile label="Hidden" value={stats?.hidden ?? '—'} icon="eye-off" color={colors.muted} />
        <StatTile label="Total" value={stats?.total ?? '—'} icon="albums" color={colors.accent2} />
      </View>

      <SegmentedControl<AdminSection>
        accessibilityLabel="Admin section"
        value={section}
        onChange={setSection}
        options={[
          { value: 'generate', label: 'Generate' },
          { value: 'review', label: awaiting ? `Review (${awaiting})` : 'Review' },
          { value: 'library', label: 'Library' },
        ]}
      />

      {error ? (
        <Banner tone="error" actionLabel="OK" onAction={clearMessages}>
          {error}
        </Banner>
      ) : null}
      {notice ? (
        <Banner tone="info" icon="checkmark-circle" actionLabel="OK" onAction={clearMessages}>
          {notice}
        </Banner>
      ) : null}

      {section === 'generate' ? <GeneratorPanel /> : null}
      {section === 'review' ? <ReviewSection /> : null}
      {section === 'library' ? (
        <>
          <LibrarySection />
          <View className="items-center pt-2">
            <Chip label={exporting ? 'Exporting…' : 'Export in-game scenarios as JSON'} icon="share-outline" onPress={exporting ? undefined : onExport} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}
