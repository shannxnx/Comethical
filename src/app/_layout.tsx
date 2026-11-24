import '../../global.css';

import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeRoot } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { feedback } from '@/services/feedback';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useStatsStore } from '@/stores/stats-store';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const hydrated = useSettingsStore((s) => s.hydrated);
  const hasOnboarded = useSettingsStore((s) => s.hasOnboarded);
  const authStatus = useAuthStore((s) => s.status);
  const { scheme, colors } = useTheme();
  const ready = hydrated && authStatus !== 'initializing';
  const canPlay = authStatus === 'signedIn' || authStatus === 'demo';

  useEffect(() => useAuthStore.getState().initialize(), []);

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync().catch(() => undefined);
    feedback.warmUp();
  }, [ready]);

  useEffect(() => {
    // Account changed: drop cached stats and reload categories for the new context.
    useStatsStore.getState().clear();
    if (canPlay) void useStatsStore.getState().loadCategories();
  }, [authStatus, canPlay]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeRoot>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="reset-password" />
            <Stack.Protected guard={ready && !hasOnboarded}>
              <Stack.Screen name="onboarding" />
            </Stack.Protected>
            <Stack.Protected guard={ready && hasOnboarded && authStatus === 'signedOut'}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
            <Stack.Protected guard={ready && hasOnboarded && canPlay}>
              <Stack.Screen name="(tabs)" />
              {/* Gameplay is outside the tabs and cannot be swiped away mid-session. */}
              <Stack.Screen name="game/[mode]" options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
              <Stack.Screen name="game/results" options={{ gestureEnabled: false, animation: 'fade' }} />
            </Stack.Protected>
          </Stack>
        </ThemeRoot>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
