import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { LogoMark, Wordmark } from '@/components/ui/Logo';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';

const BRAND_MS = 900;
let shownThisLaunch = false;
const launchedAt = Date.now();

/** Branded splash: shows the logo while state initialises, then routes to the right place. */
export default function Splash() {
  const hydrated = useSettingsStore((s) => s.hydrated);
  const hasOnboarded = useSettingsStore((s) => s.hasOnboarded);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (!hydrated || status === 'initializing') return;
    const target = !hasOnboarded
      ? '/onboarding'
      : status === 'signedOut'
        ? '/sign-in'
        : '/home';
    const wait = shownThisLaunch ? 0 : Math.max(0, BRAND_MS - (Date.now() - launchedAt));
    const t = setTimeout(() => {
      shownThisLaunch = true;
      router.replace(target);
    }, wait);
    return () => clearTimeout(t);
  }, [hydrated, hasOnboarded, status]);

  return (
    <View className="flex-1 items-center justify-center gap-5 bg-bg">
      <Animated.View entering={FadeIn.duration(400)}>
        <LogoMark size={96} />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(150).duration(400)} style={{ alignItems: 'center', gap: 8 }}>
        <Wordmark size="lg" />
        <AppText tone="muted" variant="small">
          Swipe. Think. Learn. Be Ethical.
        </AppText>
      </Animated.View>
    </View>
  );
}
