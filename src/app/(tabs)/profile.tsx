import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { LevelCard } from '@/components/game/LevelCard';
import { AppText, Avatar, Banner, Button, Icon, Screen, SectionHeader, SegmentedControl, Skeleton, StatTile, Surface, TextField, ToggleRow } from '@/components/ui';
import type { ThemePreference } from '@/config/theme.config';
import { getLevelProgress } from '@/core';
import { validateUsername } from '@/features/auth/validation';
import { formatPercent, overallAccuracy } from '@/features/analytics/insights';
import { useTheme } from '@/hooks/use-theme';
import { getRepository, isDemoMode } from '@/services/repository';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useStatsStore } from '@/stores/stats-store';
import { toAppError } from '@/utils/errors';

export default function Profile() {
  const { colors } = useTheme();
  const stats = useStatsStore((s) => s.stats);
  const refresh = useStatsStore((s) => s.refresh);
  const settings = useSettingsStore();
  const signOut = useAuthStore((s) => s.signOut);
  const demo = isDemoMode();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const saveUsername = async () => {
    const v = validateUsername(username);
    setUsernameError(v);
    if (v || saving) return;
    setSaving(true);
    try {
      await getRepository().updateUsername(username.trim());
      setEditing(false);
      await refresh();
    } catch (e) {
      setUsernameError(toAppError(e).message);
    } finally {
      setSaving(false);
    }
  };

  const confirmSignOut = () =>
    Alert.alert('Log out?', 'Your progress is saved to your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
    ]);

  const confirmReset = () =>
    Alert.alert('Reset demo progress?', 'This clears all local demo XP, stats and review items on this device. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await getRepository().resetProgress?.();
          await refresh();
        },
      },
    ]);

  const rank = stats ? getLevelProgress(stats.totalXp) : null;

  return (
    <Screen keyboard>
      <View className="items-center gap-2 pt-4">
        <Avatar name={stats?.username ?? 'Player'} size={80} />
        {editing ? (
          <View className="w-full gap-2">
            <TextField label="Username" value={username} onChangeText={setUsername} error={usernameError} autoCapitalize="none" autoFocus onSubmitEditing={saveUsername} />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button label="Cancel" variant="ghost" onPress={() => setEditing(false)} />
              </View>
              <View className="flex-1">
                <Button label="Save" loading={saving} onPress={saveUsername} />
              </View>
            </View>
          </View>
        ) : stats ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Username ${stats.username}. Tap to edit.`}
            onPress={() => {
              setUsername(stats.username);
              setUsernameError(null);
              setEditing(true);
            }}
            className="flex-row items-center gap-2"
            style={{ minHeight: 44 }}
          >
            <AppText variant="title">{stats.username}</AppText>
            <Icon name="pencil" size={16} color={colors.muted} />
          </Pressable>
        ) : (
          <Skeleton height={28} width="40%" />
        )}
        {rank ? (
          <AppText tone="muted">
            {rank.rank.title} · Level {rank.level}
          </AppText>
        ) : null}
        <View className="rounded-full px-3 py-1" style={{ backgroundColor: demo ? 'rgba(245,158,11,0.15)' : 'rgba(45,212,191,0.15)' }}>
          <AppText variant="caption" tone={demo ? 'streak' : 'accent'}>
            {demo ? 'Local demo profile' : stats?.isAdmin ? 'Administrator' : 'Online account'}
          </AppText>
        </View>
      </View>

      {stats ? <LevelCard totalXp={stats.totalXp} /> : null}

      <SectionHeader title="Lifetime stats" />
      <View className="flex-row gap-3">
        <StatTile label="Answered" value={stats?.totalAnswered ?? 0} icon="albums" color={colors.accent2} />
        <StatTile label="Accuracy" value={stats ? formatPercent(overallAccuracy(stats)) : '—'} icon="analytics" />
      </View>
      <View className="flex-row gap-3">
        <StatTile label="Highest streak" value={stats?.highestStreak ?? 0} icon="flame" color={colors.streak} />
        <StatTile label="Sessions" value={stats?.sessionsCompleted ?? 0} icon="checkmark-done" color={colors.ethical} />
      </View>

      <SectionHeader title="Settings" />
      <Surface className="gap-1">
        <ToggleRow icon="volume-high" label="Sound effects" value={settings.soundEnabled} onValueChange={settings.setSound} />
        <ToggleRow icon="phone-portrait" label="Haptic feedback" description="Vibrations on swipes and answers" value={settings.hapticsEnabled} onValueChange={settings.setHaptics} />
        <View className="gap-2 py-2">
          <View className="flex-row items-center gap-3">
            <Icon name="contrast" size={22} color={colors.muted} />
            <AppText variant="bodyStrong">Theme</AppText>
          </View>
          <SegmentedControl<ThemePreference>
            accessibilityLabel="Theme"
            value={settings.theme}
            onChange={settings.setTheme}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'System' },
            ]}
          />
        </View>
      </Surface>

      {demo ? (
        <>
          <Banner tone="demo" icon="flask">
            Demo mode stores progress only on this device. Configure Supabase in .env to enable accounts and AI-generated scenarios.
          </Banner>
          <Button label="Reset demo progress" icon="trash" variant="danger" onPress={confirmReset} />
        </>
      ) : (
        <Button label="Log out" icon="log-out" variant="danger" onPress={confirmSignOut} />
      )}

      <AppText variant="caption" tone="muted" className="text-center">
        COMETHICAL v{Constants.expoConfig?.version ?? '1.0.0'} · Swipe. Think. Learn. Be Ethical.
      </AppText>
    </Screen>
  );
}
