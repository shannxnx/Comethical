import { useColorScheme } from 'react-native';

import { PALETTES, type ColorScheme, type Palette } from '@/config/theme.config';
import { useSettingsStore } from '@/stores/settings-store';

export function useResolvedScheme(): ColorScheme {
  const preference = useSettingsStore((s) => s.theme);
  const system = useColorScheme();
  if (preference === 'system') return system === 'light' ? 'light' : 'dark';
  return preference;
}

/** Hex palette for places NativeWind classes can't reach (icons, gradients, animated styles). */
export function useTheme(): { scheme: ColorScheme; colors: Palette } {
  const scheme = useResolvedScheme();
  return { scheme, colors: PALETTES[scheme] };
}
