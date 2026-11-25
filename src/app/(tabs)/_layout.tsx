import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';

import { Icon, type IconName } from '@/components/ui';
import { pendingInvite } from '@/features/admin/pending-invite';
import { useTheme } from '@/hooks/use-theme';
import { useStatsStore } from '@/stores/stats-store';

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'home', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'progress', title: 'Progress', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  { name: 'review', title: 'Review', icon: 'refresh-circle-outline', iconActive: 'refresh-circle' },
  { name: 'profile', title: 'Profile', icon: 'person-circle-outline', iconActive: 'person-circle' },
  { name: 'admin', title: 'Admin', icon: 'shield-half-outline', iconActive: 'shield-half' },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  const isAdmin = useStatsStore((s) => s.stats?.isAdmin ?? false);

  // Someone opened an admin invite while signed out: bring them back to it once signed in.
  useEffect(() => {
    void pendingInvite.peek().then((code) => {
      if (code) router.push({ pathname: '/invite/[code]', params: { code } });
    });
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            // The Admin tab only exists for admins (the server enforces this independently).
            ...(t.name === 'admin' && !isAdmin ? { href: null } : {}),
            tabBarIcon: ({ color, focused, size }) => <Icon name={focused ? t.iconActive : t.icon} size={size} color={color as string} />,
          }}
        />
      ))}
    </Tabs>
  );
}
