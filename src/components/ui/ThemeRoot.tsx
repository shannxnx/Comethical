import { vars } from 'nativewind';
import { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';

import { paletteToCssVars } from '@/config/theme.config';
import { useTheme } from '@/hooks/use-theme';

/** Applies the active palette as CSS variables so `bg-bg`, `text-text`, etc. follow the theme. */
export function ThemeRoot({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const style = useMemo(() => [vars(paletteToCssVars(colors)), { flex: 1, backgroundColor: colors.bg }], [colors]);
  return <View style={style}>{children}</View>;
}
