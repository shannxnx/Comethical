import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Switch, View } from 'react-native';

import { CategoryLabel } from '@/components/game/CategoryLabel';
import { DifficultyBadge } from '@/components/game/DifficultyBadge';
import { AppText, Icon } from '@/components/ui';
import { withAlpha } from '@/config/theme.config';
import { calibrate } from '@/features/admin/calibration';
import { STATUS_LABELS, type AdminScenario } from '@/features/admin/types';
import { useTheme } from '@/hooks/use-theme';
import { ActionButton, FactorBars } from './AdminScenarioCard';

export interface LibraryCardProps {
  scenario: AdminScenario;
  busy: boolean;
  onToggleInGame: (inGame: boolean) => void;
  onApprove: () => void;
  onUnpublish: () => void;
  onReject: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onReassess: () => void;
}

function PlayerStats({ s }: { s: AdminScenario }) {
  const { colors } = useTheme();
  const c = calibrate(s);
  if (s.timesAnswered === 0) {
    return (
      <AppText variant="caption" tone="muted">
        No player answers yet
      </AppText>
    );
  }
  const pct = Math.round((c.observed ?? 0) * 100);
  const hint =
    c.kind === 'easier'
      ? { text: `Plays easier than ${s.difficulty}/10 (expected ~${Math.round(c.expected * 100)}%)`, color: colors.accent2, icon: 'trending-down' as const }
      : c.kind === 'harder'
        ? { text: `Plays harder than ${s.difficulty}/10 (expected ~${Math.round(c.expected * 100)}%)`, color: colors.streak, icon: 'trending-up' as const }
        : null;
  return (
    <View className="gap-1">
      <AppText variant="caption" tone="muted">
        {s.timesAnswered} answer{s.timesAnswered === 1 ? '' : 's'} · {pct}% correct
        {c.kind === 'insufficient' ? ' · too few to judge difficulty' : ''}
      </AppText>
      {hint ? (
        <View className="flex-row items-center gap-1.5">
          <Icon name={hint.icon} size={14} color={hint.color} />
          <AppText variant="caption" style={{ color: hint.color }}>
            {hint.text}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/** Compact Library row: visibility switch up front, details and actions on demand. */
export function LibraryCard({ scenario: s, busy, onToggleInGame, onApprove, onUnpublish, onReject, onDelete, onEdit, onReassess }: LibraryCardProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const approved = s.status === 'approved';
  const live = approved && s.inGame;
  const ethical = s.correctAnswer === 'ethical';
  const statusColor = live ? colors.ethical : approved ? colors.muted : s.status === 'rejected' ? colors.unethical : s.status === 'flagged' ? colors.streak : colors.accent2;
  const statusText = live ? 'In game' : approved ? 'Hidden' : STATUS_LABELS[s.status];

  const confirmDelete = () =>
    Alert.alert('Delete scenario?', 'This permanently removes it and cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);

  return (
    <View className="gap-2.5 rounded-2xl border border-border bg-card p-4" style={{ opacity: approved && !s.inGame ? 0.75 : 1 }}>
      <View className="flex-row items-center justify-between gap-2">
        <CategoryLabel categoryId={s.categoryId} size="sm" />
        <View className="flex-row items-center gap-1.5">
          <DifficultyBadge difficulty={s.difficulty} compact />
          <AppText variant="caption" tone="muted">
            {s.difficulty}/10
          </AppText>
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityHint="Shows details and actions" onPress={() => setOpen((o) => !o)}>
        <AppText variant="bodyStrong" numberOfLines={open ? undefined : 3}>
          {s.text}
        </AppText>
      </Pressable>

      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
        <View className="flex-row items-center gap-1">
          <Icon name={ethical ? 'checkmark-circle' : 'close-circle'} size={15} color={ethical ? colors.ethical : colors.unethical} />
          <AppText variant="caption" tone={ethical ? 'ethical' : 'unethical'}>
            {ethical ? 'Ethical' : 'Unethical'}
          </AppText>
        </View>
        <AppText variant="caption" tone="muted">
          {s.source === 'ai' ? 'AI-generated' : s.source === 'seed' ? 'Hand-written' : 'Manual'}
        </AppText>
      </View>

      <PlayerStats s={s} />

      {/* Visibility switch */}
      <View className="flex-row items-center gap-3 rounded-xl px-3 py-2" style={{ backgroundColor: withAlpha(statusColor, 0.1) }}>
        <View className="flex-1">
          <AppText variant="bodyStrong" style={{ color: statusColor }}>
            {statusText}
          </AppText>
          <AppText variant="caption" tone="muted">
            {live ? 'Players can get this scenario.' : approved ? 'Approved but hidden from players.' : 'Approve it before it can be shown in games.'}
          </AppText>
        </View>
        {busy ? <ActivityIndicator color={colors.accent} /> : null}
        <Switch
          accessibilityLabel={`Show in game: ${s.text.slice(0, 60)}`}
          accessibilityHint={approved ? undefined : 'Disabled until the scenario is approved'}
          value={live}
          disabled={!approved || busy}
          onValueChange={onToggleInGame}
          trackColor={{ false: colors.border, true: withAlpha(colors.ethical, 0.6) }}
          thumbColor={live ? colors.ethical : colors.muted}
        />
      </View>

      {open ? (
        <View className="gap-3 pt-1">
          <AppText variant="small" tone="muted">
            {s.explanation}
          </AppText>
          <FactorBars factors={s.difficultyFactors} />
          {s.reviewNotes ? (
            <AppText variant="small" tone="streak">
              AI reviewer: {s.reviewNotes}
            </AppText>
          ) : null}
          <View className="flex-row flex-wrap gap-2">
            {!approved ? (
              <ActionButton label="Approve" icon="checkmark-done" color={colors.ethical} onPress={onApprove} disabled={busy} />
            ) : (
              <ActionButton label="Back to drafts" icon="arrow-undo" color={colors.muted} onPress={onUnpublish} disabled={busy} />
            )}
            <ActionButton label="Edit" icon="create" color={colors.accent} onPress={onEdit} disabled={busy} />
            <ActionButton label="Re-check" icon="sparkles" color={colors.accent2} onPress={onReassess} disabled={busy} />
            {s.status !== 'rejected' ? <ActionButton label="Reject" icon="close" color={colors.unethical} onPress={onReject} disabled={busy} /> : null}
            <ActionButton label="Delete" icon="trash" color={colors.unethical} onPress={confirmDelete} disabled={busy} />
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setOpen(true)} hitSlop={6} style={{ minHeight: 28, justifyContent: 'center' }}>
          <AppText variant="caption" tone="accent">
            Details & actions
          </AppText>
        </Pressable>
      )}
    </View>
  );
}
