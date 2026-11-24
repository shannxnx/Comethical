import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ThemePreference } from '@/config/theme.config';

interface SettingsState {
  hasOnboarded: boolean;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  theme: ThemePreference;
  /** Set once persisted settings are loaded. */
  hydrated: boolean;
  completeOnboarding: () => void;
  setHaptics: (enabled: boolean) => void;
  setSound: (enabled: boolean) => void;
  setTheme: (theme: ThemePreference) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      hasOnboarded: false,
      hapticsEnabled: true,
      soundEnabled: true,
      theme: 'dark',
      hydrated: false,
      completeOnboarding: () => set({ hasOnboarded: true }),
      setHaptics: (hapticsEnabled) => set({ hapticsEnabled }),
      setSound: (soundEnabled) => set({ soundEnabled }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'comethical.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hasOnboarded, hapticsEnabled, soundEnabled, theme }) => ({
        hasOnboarded,
        hapticsEnabled,
        soundEnabled,
        theme,
      }),
      onRehydrateStorage: () => () => {
        useSettingsStore.setState({ hydrated: true });
      },
    },
  ),
);
