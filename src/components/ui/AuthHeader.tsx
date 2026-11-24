import { View } from 'react-native';

import { AppText } from './AppText';
import { LogoMark } from './Logo';

export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="items-center gap-3 pb-4 pt-8">
      <LogoMark size={64} />
      <AppText variant="title" className="text-center" accessibilityRole="header">
        {title}
      </AppText>
      <AppText tone="muted" className="text-center">
        {subtitle}
      </AppText>
    </View>
  );
}
