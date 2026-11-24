import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

/** COMETHICAL mark: a comet-shaped shield in a teal→sky gradient tile. */
export function LogoMark({ size = 72 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[colors.accent, colors.accent2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ position: 'absolute', top: size * 0.16, right: size * 0.16, width: size * 0.14, height: size * 0.14, borderRadius: size, backgroundColor: 'rgba(255,255,255,0.85)' }} />
      <Icon name="shield-checkmark" size={size * 0.56} color="#04201C" />
    </LinearGradient>
  );
}

export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const fontSize = size === 'lg' ? 34 : 24;
  return (
    <AppText accessibilityRole="header" style={{ fontSize, lineHeight: fontSize * 1.15, fontWeight: '900', letterSpacing: 2 }}>
      COM<AppText tone="accent" style={{ fontSize, fontWeight: '900', letterSpacing: 2 }}>ETHICAL</AppText>
    </AppText>
  );
}
