import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { ExplanationBody } from '@/components/feedback/ExplanationBody';
import { CategoryLabel } from '@/components/game/CategoryLabel';
import { DifficultyBadge } from '@/components/game/DifficultyBadge';
import { AppText, Button, Icon, ProgressBar, Screen, SectionHeader, StatTile, Surface } from '@/components/ui';
import { withAlpha } from '@/config/theme.config';
import { GAME_MODES, getLevelProgress } from '@/core';
import { startGame } from '@/features/gameplay/navigation';
import { useTheme } from '@/hooks/use-theme';
import { useGameStore } from '@/stores/game-store';
import { useCategory } from '@/stores/stats-store';

function CategoryRow({ categoryId, correct, incorrect }: { categoryId: string; correct: number; incorrect: number }) {
  const { colors } = useTheme();
  const category = useCategory(categoryId);
  const total = correct + incorrect;
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <CategoryLabel categoryId={categoryId} size="sm" />
        <AppText variant="caption" tone="muted">
          {correct}/{total}
        </AppText>
      </View>
      <ProgressBar value={total > 0 ? correct / total : 0} color={category.color ?? colors.accent} height={6} />
    </View>
  );
}

export default function Results() {
  const { colors } = useTheme();
  const summary = useGameStore((s) => s.summary);
  const reset = useGameStore((s) => s.reset);
  const [showMistakes, setShowMistakes] = useState(false);

  // Android back from results goes home, not back into the finished game.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      reset();
      router.replace('/home');
      return true;
    });
    return () => sub.remove();
  }, [reset]);

  if (!summary) return <Redirect href="/home" />;

  const { progress } = summary;
  const accuracyPct = Math.round(summary.accuracy * 100);
  const leveledUp = summary.levelAfter > summary.levelBefore;
  const rank = getLevelProgress(summary.totalXp).rank;
  const headline =
    accuracyPct >= 90 ? 'Outstanding judgement!' : accuracyPct >= 70 ? 'Great session!' : accuracyPct >= 50 ? 'Solid effort!' : 'Every session builds skill';

  const goHome = () => {
    reset();
    router.replace('/home');
  };
  const playAgain = () => {
    const mode = summary.mode;
    reset();
    router.replace('/home');
    startGame(mode);
  };
  const reviewMistakes = () => {
    const ids = summary.mistakes.map((m) => m.scenario.id);
    reset();
    router.replace('/home');
    startGame('review', ids);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Animated.View entering={ZoomIn.springify().damping(14)} style={{ alignItems: 'center', gap: 8, paddingTop: 24 }}>
        <View
          style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: withAlpha(colors.accent, 0.15), borderWidth: 3, borderColor: colors.accent }}
          className="items-center justify-center"
        >
          <Icon name="trophy" size={40} color={colors.accent} />
        </View>
        <AppText variant="overline" tone="muted">
          {GAME_MODES[summary.mode].title} complete
        </AppText>
        <AppText variant="title" className="text-center" accessibilityRole="header">
          {headline}
        </AppText>
        <AppText variant="display" tone="accent" accessibilityLabel={`Final score ${progress.score}`}>
          {progress.score.toLocaleString()}
        </AppText>
        <AppText variant="small" tone="muted">
          final score
        </AppText>
      </Animated.View>

      {leveledUp ? (
        <Animated.View entering={FadeInDown.delay(200)}>
          <Surface className="flex-row items-center gap-3" style={{ borderColor: colors.streak }}>
            <Icon name="arrow-up-circle" size={28} color={colors.streak} />
            <View className="flex-1">
              <AppText variant="bodyStrong" tone="streak">
                Level up! You reached level {summary.levelAfter}
              </AppText>
              <AppText variant="small" tone="muted">
                Rank: {rank.title}
              </AppText>
            </View>
          </Surface>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(120)} style={{ gap: 12 }}>
        <View className="flex-row gap-3">
          <StatTile label="Accuracy" value={`${accuracyPct}%`} icon="analytics" />
          <StatTile label="Correct" value={progress.correct} icon="checkmark-circle" color={colors.ethical} />
          <StatTile label="Incorrect" value={progress.incorrect} icon="close-circle" color={colors.unethical} />
        </View>
        <View className="flex-row gap-3">
          <StatTile label={summary.isNewBestStreak ? 'Best streak · NEW' : 'Best streak'} value={progress.bestStreak} icon="flame" color={colors.streak} />
          <StatTile label="XP earned" value={`+${summary.totalXpEarned}`} icon="sparkles" color={colors.accent2} />
        </View>
        <Surface className="flex-row items-center justify-between">
          <View>
            <AppText variant="caption" tone="muted">
              Difficulty reached
            </AppText>
            <AppText variant="bodyStrong">
              Level {progress.difficulty} of 10 {progress.maxDifficulty > progress.difficulty ? `(peak ${progress.maxDifficulty})` : ''}
            </AppText>
          </View>
          <DifficultyBadge difficulty={progress.difficulty} />
        </Surface>
        {summary.completionXp > 0 ? (
          <AppText variant="small" tone="muted" className="text-center">
            Includes +{summary.completionXp} XP session completion bonus
          </AppText>
        ) : null}
      </Animated.View>

      {Object.keys(progress.categoryResults).length > 0 ? (
        <>
          <SectionHeader title="By category" />
          <Surface className="gap-3">
            {Object.entries(progress.categoryResults)
              .sort(([, a], [, b]) => b.correct + b.incorrect - (a.correct + a.incorrect))
              .map(([id, t]) => (
                <CategoryRow key={id} categoryId={id} correct={t.correct} incorrect={t.incorrect} />
              ))}
          </Surface>
        </>
      ) : null}

      {summary.mistakes.length > 0 ? (
        <>
          <SectionHeader
            title={`Mistakes (${summary.mistakes.length})`}
            action={showMistakes ? 'Hide' : 'Show'}
            onAction={() => setShowMistakes((v) => !v)}
          />
          {showMistakes
            ? summary.mistakes.map((m) => (
                <Surface key={m.scenario.id} className="gap-3">
                  <CategoryLabel categoryId={m.scenario.categoryId} size="sm" />
                  <AppText variant="bodyStrong">{m.scenario.text}</AppText>
                  <ExplanationBody explanation={m.explanation} selected={m.selected} />
                </Surface>
              ))
            : null}
        </>
      ) : null}

      <View className="gap-3 pt-2">
        {summary.mistakes.length > 0 ? (
          <Button label={`Review ${summary.mistakes.length} mistake${summary.mistakes.length > 1 ? 's' : ''}`} icon="refresh-circle" variant="secondary" onPress={reviewMistakes} />
        ) : null}
        <Button label="Play again" icon="play" size="lg" onPress={playAgain} />
        <Button label="Return home" variant="ghost" onPress={goHome} />
      </View>
    </Screen>
  );
}
