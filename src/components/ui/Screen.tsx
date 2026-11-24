import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  keyboard?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentClassName?: string;
}

/** Safe-area aware page container with a 16pt gutter. */
export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  keyboard = false,
  refreshing,
  onRefresh,
  contentClassName = '',
}: ScreenProps) {
  const { colors } = useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerClassName={`px-4 pb-10 pt-2 gap-4 ${contentClassName}`}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View className={`flex-1 px-4 ${contentClassName}`}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.bg }}>
      {keyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}
