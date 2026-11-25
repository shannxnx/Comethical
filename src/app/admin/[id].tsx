import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { FactorBars } from '@/components/admin/AdminScenarioCard';
import { AppText, Banner, Button, Chip, Icon, Screen, SegmentedControl, Surface, TextField } from '@/components/ui';
import { getDifficultyTier, type EthicalAnswer } from '@/core';
import { validateScenarioForm } from '@/features/admin/validation';
import { useTheme } from '@/hooks/use-theme';
import { useAdminStore } from '@/stores/admin-store';
import { useStatsStore } from '@/stores/stats-store';

const multiline = { fontSize: 16, minHeight: 88, textAlignVertical: 'top' as const, paddingVertical: 12, flex: 1 };

export default function EditScenario() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const scenario = useAdminStore((s) => s.reviewItems.find((x) => x.id === id) ?? s.libraryItems.find((x) => x.id === id));
  const busy = useAdminStore((s) => !!(id && s.busy[id]));
  const serverError = useAdminStore((s) => s.error);
  const save = useAdminStore((s) => s.save);
  const isAdmin = useStatsStore((s) => s.stats?.isAdmin ?? false);
  const categories = useStatsStore((s) => s.categories);

  const [categoryId, setCategoryId] = useState(scenario?.categoryId ?? '');
  const [text, setText] = useState(scenario?.text ?? '');
  const [answer, setAnswer] = useState<EthicalAnswer>(scenario?.correctAnswer ?? 'unethical');
  const [explanation, setExplanation] = useState(scenario?.explanation ?? '');
  const [principles, setPrinciples] = useState(scenario?.ethicalPrinciples.join(', ') ?? '');
  const [recommended, setRecommended] = useState(scenario?.recommendedAction ?? '');
  const [objective, setObjective] = useState(scenario?.learningObjective ?? '');
  const [difficulty, setDifficulty] = useState(scenario?.difficulty ?? 5);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isAdmin || !scenario || !id) return <Redirect href="/admin" />;

  const submit = async (approve: boolean) => {
    const patch = {
      categoryId,
      text: text.trim(),
      correctAnswer: answer,
      explanation: explanation.trim(),
      ethicalPrinciples: principles.split(',').map((p) => p.trim()).filter(Boolean),
      recommendedAction: recommended.trim() || null,
      learningObjective: objective.trim() || null,
      difficulty,
      difficultyReasoning: difficulty === scenario.difficulty ? scenario.difficultyReasoning : 'Adjusted by an administrator.',
    };
    const found = validateScenarioForm(patch);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (await save(id, patch, approve)) router.back();
  };

  return (
    <Screen keyboard edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 pt-2">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8} className="items-center justify-center rounded-xl bg-card" style={{ width: 44, height: 44 }}>
          <Icon name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <AppText variant="title" accessibilityRole="header">
          Edit scenario
        </AppText>
      </View>

      {serverError ? <Banner tone="error">{serverError}</Banner> : null}

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

      <TextField label={`Scenario (${text.length}/320)`} value={text} onChangeText={setText} multiline maxLength={320} error={errors.text} style={{ ...multiline, color: colors.text }} />

      <View className="gap-2">
        <AppText variant="caption" tone="muted">
          Correct answer
        </AppText>
        <SegmentedControl<EthicalAnswer>
          accessibilityLabel="Correct answer"
          value={answer}
          onChange={setAnswer}
          options={[
            { value: 'ethical', label: 'Ethical (swipe left)' },
            { value: 'unethical', label: 'Unethical (swipe right)' },
          ]}
        />
      </View>

      <TextField label="Explanation" value={explanation} onChangeText={setExplanation} multiline maxLength={700} error={errors.explanation} style={{ ...multiline, color: colors.text }} />
      <TextField label="Ethical principles (comma separated, 1–5)" value={principles} onChangeText={setPrinciples} error={errors.principles} />
      <TextField label="Recommended action (optional)" value={recommended} onChangeText={setRecommended} multiline maxLength={400} style={{ ...multiline, color: colors.text, minHeight: 64 }} />
      <TextField label="Learning objective" value={objective} onChangeText={setObjective} error={errors.objective} />

      <Surface className="gap-3">
        <View className="flex-row items-center justify-between">
          <View>
            <AppText variant="caption" tone="muted">
              Difficulty
            </AppText>
            <AppText variant="bodyStrong">
              {difficulty}/10 · {getDifficultyTier(difficulty).label}
            </AppText>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable accessibilityRole="button" accessibilityLabel="Easier" onPress={() => setDifficulty((d) => Math.max(1, d - 1))} className="items-center justify-center rounded-lg bg-surface" style={{ width: 40, height: 40 }}>
              <Icon name="remove" size={18} color={colors.text} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Harder" onPress={() => setDifficulty((d) => Math.min(10, d + 1))} className="items-center justify-center rounded-lg bg-surface" style={{ width: 40, height: 40 }}>
              <Icon name="add" size={18} color={colors.text} />
            </Pressable>
          </View>
        </View>
        <FactorBars factors={scenario.difficultyFactors} />
        <AppText variant="caption" tone="muted">
          AI reasoning: {scenario.difficultyReasoning}
        </AppText>
      </Surface>

      <View className="gap-3 pt-2">
        <Button label="Save & approve" icon="checkmark-done" size="lg" loading={busy} onPress={() => void submit(true)} />
        <Button label="Save as draft" variant="secondary" disabled={busy} onPress={() => void submit(false)} />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
