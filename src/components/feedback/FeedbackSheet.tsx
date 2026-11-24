import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withAlpha } from '@/config/theme.config';
import { useTheme } from '@/hooks/use-theme';
import type { AnswerOutcome, ReportReason } from '@/types/game';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Chip } from '../ui/misc';
import { ExplanationBody } from './ExplanationBody';

const ENCOURAGEMENT = [
  'Not quite — here is what to consider.',
  'Good try! This one is trickier than it looks.',
  'Close call. Let us look at why.',
  'Every mistake is a lesson. Here is the reasoning.',
];

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'incorrect_answer', label: 'Answer seems wrong' },
  { value: 'ambiguous', label: 'Could be either' },
  { value: 'unclear', label: 'Unclear wording' },
  { value: 'offensive', label: 'Inappropriate' },
];

export interface FeedbackSheetProps {
  outcome: AnswerOutcome;
  onContinue: () => void;
  onReport?: (reason: ReportReason) => Promise<void>;
}

/** Educational feedback after an incorrect answer. Never auto-dismisses. */
export function FeedbackSheet({ outcome, onContinue, onReport }: FeedbackSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const message = ENCOURAGEMENT[outcome.scenarioId.length % ENCOURAGEMENT.length];

  const report = async (reason: ReportReason) => {
    if (!onReport) return;
    try {
      await onReport(reason);
    } finally {
      setReported(true);
      setReporting(false);
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(2,6,23,0.6)' }]} />
      <Animated.View
        entering={SlideInDown.springify().damping(18).stiffness(160)}
        exiting={SlideOutDown.duration(220)}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '88%',
          backgroundColor: colors.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTopWidth: 1,
          borderColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
      >
        <View className="items-center pt-3">
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        </View>
        <ScrollView contentContainerClassName="gap-4 px-5 pb-4 pt-3" showsVerticalScrollIndicator={false}>
          <View className="flex-row items-center gap-3">
            <View
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: withAlpha(colors.streak, 0.15) }}
              className="items-center justify-center"
            >
              <Icon name="school" size={22} color={colors.streak} />
            </View>
            <View className="flex-1">
              <AppText variant="heading" accessibilityRole="header">
                Let&apos;s learn from this
              </AppText>
              <AppText variant="small" tone="muted">
                {message}
              </AppText>
            </View>
          </View>

          <ExplanationBody explanation={outcome} selected={outcome.selected} />

          {onReport ? (
            <View className="gap-2">
              {reported ? (
                <AppText variant="small" tone="muted">
                  Thanks — this scenario was flagged for review.
                </AppText>
              ) : reporting ? (
                <View className="flex-row flex-wrap gap-2">
                  {REPORT_REASONS.map((r) => (
                    <Chip key={r.value} label={r.label} color={colors.muted} onPress={() => void report(r.value)} />
                  ))}
                </View>
              ) : (
                <Chip label="Report a problem with this scenario" icon="flag-outline" color={colors.muted} onPress={() => setReporting(true)} />
              )}
            </View>
          ) : null}
        </ScrollView>
        <View className="px-5 pt-2">
          <Button label="Continue" iconRight="arrow-forward" size="lg" onPress={onContinue} />
        </View>
      </Animated.View>
    </View>
  );
}
