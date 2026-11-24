import { View } from 'react-native';

import type { EthicalAnswer, ScenarioExplanation } from '@/core';
import { withAlpha } from '@/config/theme.config';
import { useTheme } from '@/hooks/use-theme';
import { AppText } from '../ui/AppText';
import { Icon } from '../ui/Icon';
import { Chip } from '../ui/misc';

export function AnswerTag({ answer, label }: { answer: EthicalAnswer; label: string }) {
  const { colors } = useTheme();
  const ethical = answer === 'ethical';
  const tint = ethical ? colors.ethical : colors.unethical;
  return (
    <View className="flex-1 gap-1 rounded-xl p-3" style={{ backgroundColor: withAlpha(tint, 0.1), borderWidth: 1, borderColor: withAlpha(tint, 0.4) }}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <View className="flex-row items-center gap-1.5">
        <Icon name={ethical ? 'checkmark-circle' : 'close-circle'} size={18} color={tint} />
        <AppText variant="bodyStrong" style={{ color: tint }}>
          {ethical ? 'Ethical' : 'Unethical'}
        </AppText>
      </View>
    </View>
  );
}

/** Shared explanation layout: used by the feedback sheet, results and review screens. */
export function ExplanationBody({ explanation, selected }: { explanation: ScenarioExplanation; selected?: EthicalAnswer }) {
  const { colors } = useTheme();
  return (
    <View className="gap-4">
      <View className="flex-row gap-3">
        {selected ? <AnswerTag answer={selected} label="Your answer" /> : null}
        <AnswerTag answer={explanation.correctAnswer} label="Correct answer" />
      </View>

      <View className="gap-1.5">
        <AppText variant="overline" tone="muted">
          Why
        </AppText>
        <AppText>{explanation.explanation}</AppText>
      </View>

      {explanation.ethicalPrinciples.length > 0 ? (
        <View className="gap-2">
          <AppText variant="overline" tone="muted">
            Ethical principles
          </AppText>
          <View className="flex-row flex-wrap gap-2">
            {explanation.ethicalPrinciples.map((p) => (
              <Chip key={p} label={p} icon="ribbon" color={colors.accent2} />
            ))}
          </View>
        </View>
      ) : null}

      {explanation.recommendedAction ? (
        <View className="flex-row gap-3 rounded-xl p-3" style={{ backgroundColor: withAlpha(colors.accent, 0.1) }}>
          <Icon name="bulb" size={20} color={colors.accent} />
          <View className="flex-1 gap-0.5">
            <AppText variant="caption" tone="accent">
              A better choice
            </AppText>
            <AppText variant="small">{explanation.recommendedAction}</AppText>
          </View>
        </View>
      ) : null}

      {explanation.learningObjective ? (
        <AppText variant="small" tone="muted">
          Takeaway: {explanation.learningObjective}
        </AppText>
      ) : null}
    </View>
  );
}
