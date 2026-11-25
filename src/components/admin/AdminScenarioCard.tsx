import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { CategoryLabel } from '@/components/game/CategoryLabel';
import { DifficultyBadge } from '@/components/game/DifficultyBadge';
import { AppText, Chip, Icon, type IconName } from '@/components/ui';
import { withAlpha } from '@/config/theme.config';
import { DIFFICULTY_FACTORS } from '@/core';
import { STATUS_LABELS, type AdminScenario } from '@/features/admin/types';
import { useTheme } from '@/hooks/use-theme';

export function ActionButton({
  label,
  icon,
  color,
  onPress,
  disabled,
}: {
  label: string;
  icon: IconName;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      className="flex-row items-center gap-1.5 rounded-lg px-3"
      style={{ minHeight: 38, backgroundColor: withAlpha(color, 0.14), opacity: disabled ? 0.5 : 1 }}
    >
      <Icon name={icon} size={15} color={color} />
      <AppText variant="caption" style={{ color }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** The seven difficulty criteria as compact bars (1–10 each). */
export function FactorBars({ factors }: { factors: AdminScenario['difficultyFactors'] }) {
  const { colors } = useTheme();
  if (!factors) {
    return (
      <AppText variant="caption" tone="muted">
        No factor breakdown yet. Use Re-check to have Gemini score it.
      </AppText>
    );
  }
  return (
    <View className="flex-row flex-wrap gap-x-3 gap-y-1.5" accessible accessibilityLabel={DIFFICULTY_FACTORS.map((f) => `${f.label} ${factors[f.key]} of 10`).join(', ')}>
      {DIFFICULTY_FACTORS.map((f) => (
        <View key={f.key} style={{ width: '30%' }} className="gap-0.5">
          <View className="flex-row justify-between">
            <AppText variant="caption" tone="muted" style={{ fontSize: 10 }}>
              {f.label}
            </AppText>
            <AppText variant="caption" style={{ fontSize: 10 }}>
              {factors[f.key]}
            </AppText>
          </View>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border }}>
            <View style={{ height: 4, borderRadius: 2, width: `${factors[f.key] * 10}%`, backgroundColor: colors.accent2 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export interface AdminScenarioCardProps {
  scenario: AdminScenario;
  busy: boolean;
  onApprove: () => void;
  onUnpublish: () => void;
  onReject: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onReassess: () => void;
}

export function AdminScenarioCard({ scenario: s, busy, onApprove, onUnpublish, onReject, onDelete, onEdit, onReassess }: AdminScenarioCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const statusColor =
    s.status === 'approved' ? colors.ethical : s.status === 'rejected' ? colors.unethical : s.status === 'flagged' ? colors.streak : colors.accent2;
  const ethical = s.correctAnswer === 'ethical';

  const confirmDelete = () =>
    Alert.alert('Delete scenario?', 'This permanently removes it. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);

  return (
    <View className="gap-3 rounded-2xl border border-border bg-card p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <CategoryLabel categoryId={s.categoryId} size="sm" />
        <View className="flex-row items-center gap-2">
          <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: withAlpha(statusColor, 0.16) }}>
            <AppText variant="caption" style={{ color: statusColor }}>
              {STATUS_LABELS[s.status]}
            </AppText>
          </View>
          <DifficultyBadge difficulty={s.difficulty} />
          <AppText variant="caption" tone="muted">
            {s.difficulty}/10
          </AppText>
        </View>
      </View>

      <AppText variant="bodyStrong">{s.text}</AppText>

      <FactorBars factors={s.difficultyFactors} />

      <View className="flex-row items-center gap-1.5">
        <AppText variant="caption" tone="muted">
          Answer:
        </AppText>
        <Icon name={ethical ? 'checkmark-circle' : 'close-circle'} size={16} color={ethical ? colors.ethical : colors.unethical} />
        <AppText variant="bodyStrong" tone={ethical ? 'ethical' : 'unethical'}>
          {ethical ? 'Ethical' : 'Unethical'}
        </AppText>
      </View>

      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((e) => !e)}>
        <AppText variant="small" tone="muted" numberOfLines={expanded ? undefined : 2}>
          {s.explanation}
        </AppText>
        {expanded ? (
          <View className="mt-2 gap-2">
            {s.recommendedAction ? <AppText variant="small">Better choice: {s.recommendedAction}</AppText> : null}
            {s.learningObjective ? (
              <AppText variant="small" tone="muted">
                Objective: {s.learningObjective}
              </AppText>
            ) : null}
            <AppText variant="small" tone="muted">
              Difficulty reasoning: {s.difficultyReasoning}
            </AppText>
            {s.adminInstructions ? (
              <AppText variant="small" tone="muted">
                Brief: “{s.adminInstructions}”
              </AppText>
            ) : null}
            {s.timesAnswered > 0 ? (
              <AppText variant="small" tone="muted">
                Players: {s.timesCorrect}/{s.timesAnswered} correct ({Math.round((s.timesCorrect / s.timesAnswered) * 100)}%)
              </AppText>
            ) : null}
          </View>
        ) : null}
        <AppText variant="caption" tone="accent" className="mt-1">
          {expanded ? 'Show less' : 'Show details'}
        </AppText>
      </Pressable>

      <View className="flex-row flex-wrap gap-1.5">
        {s.ethicalPrinciples.map((p) => (
          <Chip key={p} label={p} color={colors.accent2} />
        ))}
      </View>

      {s.reviewNotes ? (
        <View className="flex-row gap-2 rounded-lg p-2.5" style={{ backgroundColor: withAlpha(colors.streak, 0.1) }}>
          <Icon name="alert-circle" size={16} color={colors.streak} />
          <AppText variant="small" className="flex-1">
            AI reviewer: {s.reviewNotes}
          </AppText>
        </View>
      ) : null}

      <View className="flex-row flex-wrap items-center gap-2">
        {busy ? <ActivityIndicator color={colors.accent} /> : null}
        {s.status !== 'approved' ? (
          <ActionButton label="Approve" icon="checkmark-done" color={colors.ethical} onPress={onApprove} disabled={busy} />
        ) : (
          <ActionButton label="Unpublish" icon="eye-off" color={colors.muted} onPress={onUnpublish} disabled={busy} />
        )}
        <ActionButton label="Edit" icon="create" color={colors.accent} onPress={onEdit} disabled={busy} />
        <ActionButton label="Re-check" icon="sparkles" color={colors.accent2} onPress={onReassess} disabled={busy} />
        {s.status !== 'rejected' ? <ActionButton label="Reject" icon="close" color={colors.unethical} onPress={onReject} disabled={busy} /> : null}
        <ActionButton label="Delete" icon="trash" color={colors.unethical} onPress={confirmDelete} disabled={busy} />
      </View>
    </View>
  );
}
