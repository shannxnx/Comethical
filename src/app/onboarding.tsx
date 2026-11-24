import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExplanationBody } from '@/components/feedback/ExplanationBody';
import { SwipeCard } from '@/components/game/SwipeCard';
import { AppText, Button, Icon, type IconName } from '@/components/ui';
import { LogoMark, Wordmark } from '@/components/ui/Logo';
import { withAlpha } from '@/config/theme.config';
import { directionToAnswer, type SwipeDirection } from '@/core';
import { ONBOARDING_SCENARIO } from '@/data/seed-scenarios';
import { useTheme } from '@/hooks/use-theme';
import { feedback } from '@/services/feedback';
import { useSettingsStore } from '@/stores/settings-store';

interface Slide {
  icon: IconName;
  title: string;
  body: string;
  points: { icon: IconName; text: string }[];
}

const SLIDES: Slide[] = [
  {
    icon: 'sparkles',
    title: 'Learn computer ethics by playing',
    body: 'COMETHICAL turns real-world technology dilemmas into quick, swipeable scenarios.',
    points: [
      { icon: 'lock-closed', text: 'Privacy, security, AI, social media and more' },
      { icon: 'flame', text: 'Build streaks, earn XP and rank up' },
    ],
  },
  {
    icon: 'swap-horizontal',
    title: 'Swipe to decide',
    body: 'Read the scenario, then judge the action.',
    points: [
      { icon: 'arrow-back-circle', text: 'Swipe LEFT if it is Ethical' },
      { icon: 'arrow-forward-circle', text: 'Swipe RIGHT if it is Unethical' },
      { icon: 'hand-left', text: 'Prefer tapping? Use the buttons under the card' },
    ],
  },
  {
    icon: 'trending-up',
    title: 'Difficulty that adapts to you',
    body: 'Every scenario has a difficulty from 1 to 10, estimated by AI and checked against how players actually do.',
    points: [
      { icon: 'arrow-up-circle', text: 'Doing great? Scenarios get more nuanced' },
      { icon: 'arrow-down-circle', text: 'Struggling? Things ease up so you can build confidence' },
    ],
  },
  {
    icon: 'school',
    title: 'Mistakes are how you learn',
    body: 'Get one wrong and you will see why — the principle involved and a better choice.',
    points: [
      { icon: 'refresh-circle', text: 'Smart Review brings back what you missed' },
      { icon: 'stats-chart', text: 'Track your strongest and weakest topics' },
    ],
  },
];

export default function Onboarding() {
  const { colors } = useTheme();
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<'ethical' | 'unethical' | null>(null);
  const isPractice = step === SLIDES.length;
  const slide = SLIDES[step];

  const finish = useCallback(() => {
    completeOnboarding();
    router.replace('/');
  }, [completeOnboarding]);

  const onSwipe = useCallback((direction: SwipeDirection) => {
    const selected = directionToAnswer(direction);
    setAnswer(selected);
    if (selected === ONBOARDING_SCENARIO.correctAnswer) feedback.correct();
    else feedback.incorrect();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between px-4 py-2">
        <View className="flex-row gap-1.5" accessibilityLabel={`Step ${step + 1} of ${SLIDES.length + 1}`}>
          {[...SLIDES, null].map((_, i) => (
            <View
              key={i}
              style={{ height: 6, width: i === step ? 22 : 6, borderRadius: 3, backgroundColor: i <= step ? colors.accent : colors.border }}
            />
          ))}
        </View>
        {!isPractice ? (
          <Pressable accessibilityRole="button" onPress={() => setStep(SLIDES.length)} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }}>
            <AppText variant="bodyStrong" tone="muted">
              Skip
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {slide ? (
        <Animated.View key={step} entering={FadeInRight.duration(280)} style={{ flex: 1, justifyContent: 'center', gap: 24, paddingHorizontal: 24 }}>
          {step === 0 ? (
            <View className="items-center gap-4">
              <LogoMark size={88} />
              <Wordmark size="lg" />
            </View>
          ) : (
            <View
              style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: withAlpha(colors.accent, 0.14) }}
              className="items-center justify-center self-center"
            >
              <Icon name={slide.icon} size={36} color={colors.accent} />
            </View>
          )}
          <View className="gap-2">
            <AppText variant="title" className="text-center">
              {slide.title}
            </AppText>
            <AppText tone="muted" className="text-center">
              {slide.body}
            </AppText>
          </View>
          <View className="gap-3">
            {slide.points.map((p) => (
              <View key={p.text} className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <Icon
                  name={p.icon}
                  size={24}
                  color={p.icon === 'arrow-back-circle' ? colors.ethical : p.icon === 'arrow-forward-circle' ? colors.unethical : colors.accent}
                />
                <AppText className="flex-1">{p.text}</AppText>
              </View>
            ))}
          </View>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1, gap: 16, paddingHorizontal: 16 }}>
          <View className="items-center gap-1">
            <AppText variant="title">Try one</AppText>
            <AppText tone="muted" className="text-center">
              Swipe left for Ethical, right for Unethical.
            </AppText>
          </View>
          {answer === null ? (
            <View className="flex-1 pb-2">
              <SwipeCard scenario={ONBOARDING_SCENARIO} enabled onSwipe={onSwipe} />
            </View>
          ) : (
            <Animated.ScrollView entering={FadeIn} contentContainerStyle={{ gap: 16, paddingBottom: 16 }} style={{ flex: 1 }}>
              <View className="items-center gap-2">
                <Icon
                  name={answer === ONBOARDING_SCENARIO.correctAnswer ? 'checkmark-circle' : 'bulb'}
                  size={48}
                  color={answer === ONBOARDING_SCENARIO.correctAnswer ? colors.ethical : colors.streak}
                />
                <AppText variant="heading">
                  {answer === ONBOARDING_SCENARIO.correctAnswer ? 'Nice — that is right!' : 'Good try — here is why'}
                </AppText>
              </View>
              <View className="rounded-2xl border border-border bg-card p-4">
                <ExplanationBody explanation={ONBOARDING_SCENARIO} selected={answer} />
              </View>
            </Animated.ScrollView>
          )}
        </Animated.View>
      )}

      <View className="gap-2 px-4 pb-2 pt-3">
        {isPractice ? (
          answer === null ? (
            <Button label="Skip practice" variant="ghost" onPress={finish} />
          ) : (
            <Button label="Start playing" iconRight="arrow-forward" size="lg" onPress={finish} />
          )
        ) : (
          <Button label={step === SLIDES.length - 1 ? 'Try a scenario' : 'Next'} iconRight="arrow-forward" size="lg" onPress={() => setStep((s) => s + 1)} />
        )}
      </View>
    </SafeAreaView>
  );
}
