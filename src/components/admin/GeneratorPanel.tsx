import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Button, Chip, Icon, Surface, TextField } from '@/components/ui';
import { DIFFICULTY_TIERS, type DifficultyTierId } from '@/core';
import { useTheme } from '@/hooks/use-theme';
import { useAdminStore } from '@/stores/admin-store';
import { useStatsStore } from '@/stores/stats-store';

export function GeneratorPanel() {
  const { colors } = useTheme();
  const categories = useStatsStore((s) => s.categories);
  const generating = useAdminStore((s) => s.generating);
  const generate = useAdminStore((s) => s.generate);

  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? 'data-privacy');
  const [tierId, setTierId] = useState<DifficultyTierId>('intermediate');
  const [count, setCount] = useState(2);
  const [instructions, setInstructions] = useState('');
  const tier = DIFFICULTY_TIERS.find((t) => t.id === tierId) ?? DIFFICULTY_TIERS[2]!;

  const onGenerate = async () => {
    const ok = await generate({ categoryId, difficultyMin: tier.min, difficultyMax: tier.max, count, instructions });
    if (ok) setInstructions('');
  };

  const stepper = (label: string, icon: 'add' | 'remove', onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="items-center justify-center rounded-lg bg-surface" style={{ width: 40, height: 40 }}>
      <Icon name={icon} size={18} color={colors.text} />
    </Pressable>
  );

  return (
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
          {stepper('Fewer', 'remove', () => setCount((c) => Math.max(1, c - 1)))}
          <AppText variant="heading" accessibilityLabel={`${count} scenarios`}>
            {count}
          </AppText>
          {stepper('More', 'add', () => setCount((c) => Math.min(5, c + 1)))}
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
        label={generating ? 'Gemini is writing…' : `Generate ${count} scenario${count > 1 ? 's' : ''}`}
        icon="sparkles"
        loading={generating}
        onPress={onGenerate}
      />
      <AppText variant="caption" tone="muted">
        Gemini expands your idea into complete flashcards, then a second AI pass scores difficulty and flags anything ambiguous. New scenarios land
        in Review as drafts. Nothing reaches players until you approve it.
      </AppText>
    </Surface>
  );
}
