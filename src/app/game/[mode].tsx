import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedbackSheet } from '@/components/feedback/FeedbackSheet';
import { AnswerButtons } from '@/components/game/AnswerButtons';
import { GameHeader } from '@/components/game/GameHeader';
import { SwipeCard, type SwipeCardHandle } from '@/components/game/SwipeCard';
import { CorrectFeedback, DifficultyToast, MilestoneToast } from '@/components/game/Toasts';
import { AppText, Banner, Button, EmptyState, Icon, Skeleton } from '@/components/ui';
import { GAME_MODES, SESSION, directionToAnswer, isGameModeId, type SwipeDirection } from '@/core';
import { useTheme } from '@/hooks/use-theme';
import { feedback } from '@/services/feedback';
import { getRepository } from '@/services/repository';
import { useGameStore, type GamePhase } from '@/stores/game-store';
import type { ReportReason } from '@/types/game';

const IN_PROGRESS: GamePhase[] = ['loading', 'ready', 'submitting', 'correct', 'incorrect'];

export default function GameScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ mode: string; ids?: string }>();
  const mode = isGameModeId(params.mode) ? params.mode : null;
  const cardRef = useRef<SwipeCardHandle>(null);

  const phase = useGameStore((s) => s.phase);
  const queue = useGameStore((s) => s.queue);
  const progress = useGameStore((s) => s.progress);
  const plannedLength = useGameStore((s) => s.plannedLength);
  const outcome = useGameStore((s) => s.outcome);
  const milestone = useGameStore((s) => s.milestone);
  const difficultyNotice = useGameStore((s) => s.difficultyNotice);
  const summary = useGameStore((s) => s.summary);
  const error = useGameStore((s) => s.error);
  const cardResetKey = useGameStore((s) => s.cardResetKey);
  const sessionId = useGameStore((s) => s.sessionId);
  const { start, answer, advance, finish, retry, dismissError } = useGameStore.getState();

  const current = queue[0];
  const next = queue[1];

  // Start the session once per screen mount.
  useEffect(() => {
    if (!mode) return;
    const ids = params.ids ? params.ids.split(',').filter(Boolean) : undefined;
    void start(mode, ids ? { scenarioIds: ids } : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, params.ids]);

  // Correct: celebrate briefly, then move on automatically.
  useEffect(() => {
    if (phase === 'correct') {
      feedback.correct();
      const t = setTimeout(() => useGameStore.getState().advance(), SESSION.correctFeedbackMs);
      return () => clearTimeout(t);
    }
    if (phase === 'incorrect') feedback.incorrect();
    return undefined;
  }, [phase]);

  useEffect(() => {
    if (milestone) feedback.milestone();
  }, [milestone]);

  // Session over: show results (completed) or go home (abandoned).
  useEffect(() => {
    if (phase !== 'complete' || !summary) return;
    if (summary.status === 'completed' && summary.answered > 0) router.replace('/game/results');
    else router.replace('/home');
  }, [phase, summary]);

  const confirmLeave = useCallback(
    () => {
      Alert.alert('Leave this session?', 'Answers so far are saved, but you will not get the session completion bonus.', [
        { text: 'Keep playing', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            // finish() flips the phase to complete → the effect above navigates home.
            void finish('abandoned');
          },
        },
      ]);
    },
    [finish],
  );

  // Guard against accidental exits (Android back, gestures, links) while a session is running.
  // Leaving finishes the session as abandoned; the completion effect then navigates home.
  const inProgress = IN_PROGRESS.includes(phase) && !!sessionId;
  usePreventRemove(inProgress, () => confirmLeave());

  const confirmEnd = useCallback(() => {
    Alert.alert('End session?', 'Wrap up this endless run and see your results.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'End session', onPress: () => void finish('completed') },
    ]);
  }, [finish]);

  const onSwipe = useCallback(
    (direction: SwipeDirection) => {
      feedback.tap();
      void answer(directionToAnswer(direction));
    },
    [answer],
  );

  const onReport = useCallback(async (reason: ReportReason) => {
    const id = useGameStore.getState().outcome?.scenarioId;
    if (!id) return;
    try {
      await getRepository().reportScenario(id, reason);
    } catch {
      // Reporting is best-effort.
    }
  }, []);

  if (!mode) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} className="justify-center px-4">
        <EmptyState icon="help-circle" title="Unknown game mode" message="That mode does not exist." actionLabel="Go home" onAction={() => router.replace('/home')} />
      </SafeAreaView>
    );
  }

  // Blocking errors (could not start / load / finish).
  if (phase === 'error' && error && error.during !== 'answer') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} className="justify-center gap-3 px-4">
        <EmptyState
          icon={error.message.toLowerCase().includes('offline') ? 'cloud-offline' : 'alert-circle'}
          title={error.during === 'start' ? 'Could not start the session' : 'Something interrupted the game'}
          message={error.message}
          actionLabel={error.retryable ? 'Try again' : undefined}
          onAction={error.retryable ? retry : undefined}
        />
        <Button label="Back to home" variant="ghost" onPress={() => router.replace('/home')} />
      </SafeAreaView>
    );
  }

  const inputEnabled = phase === 'ready' && !!current;
  const modeDef = GAME_MODES[mode];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View className="flex-1 gap-4 px-4 pb-2 pt-2">
        {progress ? (
          <GameHeader
            progress={progress}
            plannedLength={plannedLength}
            onExit={() => confirmLeave()}
            onEnd={modeDef.sessionLength === null ? confirmEnd : undefined}
            showingFeedback={phase === 'correct' || phase === 'incorrect' || phase === 'completing'}
          />
        ) : (
          <Skeleton height={64} radius={16} />
        )}

        {error?.during === 'answer' ? (
          <Banner tone="error" actionLabel="OK" onAction={dismissError}>
            {error.message}
          </Banner>
        ) : null}

        <View className="flex-1">
          {phase === 'submitting' ? (
            <View className="absolute inset-0 items-center justify-center">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null}

          {phase === 'loading' || (phase === 'completing' && !current) ? (
            <View className="flex-1 gap-4 rounded-3xl border border-border bg-card p-5">
              <Skeleton height={28} width="55%" />
              <View className="flex-1 justify-center gap-3">
                <Skeleton height={18} />
                <Skeleton height={18} />
                <Skeleton height={18} width="70%" />
              </View>
              <AppText variant="small" tone="muted" className="text-center">
                {phase === 'completing' ? 'Wrapping up…' : 'Finding your next scenario…'}
              </AppText>
            </View>
          ) : phase === 'correct' && outcome ? (
            <CorrectFeedback points={outcome.pointsEarned} xp={outcome.xpEarned} />
          ) : current ? (
            <>
              {next ? (
                <View
                  pointerEvents="none"
                  className="absolute inset-x-3 bottom-0 top-3 rounded-3xl border border-border bg-card"
                  style={{ opacity: 0.45, transform: [{ scale: 0.96 }] }}
                />
              ) : null}
              <SwipeCard key={`${current.id}-${cardResetKey}`} ref={cardRef} scenario={current} enabled={inputEnabled} onSwipe={onSwipe} />
            </>
          ) : null}

          <MilestoneToast milestone={milestone} />
          <DifficultyToast notice={difficultyNotice} />
        </View>

        <AnswerButtons disabled={!inputEnabled} onAnswer={(d) => cardRef.current?.swipe(d)} />
        <View className="flex-row items-center justify-center gap-2" accessibilityElementsHidden>
          <Icon name="swap-horizontal" size={14} color={colors.muted} />
          <AppText variant="caption" tone="muted">
            Swipe left = Ethical · Swipe right = Unethical
          </AppText>
        </View>
      </View>

      {phase === 'incorrect' && outcome ? <FeedbackSheet outcome={outcome} onContinue={advance} onReport={onReport} /> : null}
    </SafeAreaView>
  );
}
