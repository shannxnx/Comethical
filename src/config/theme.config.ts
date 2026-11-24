/**
 * COMETHICAL design system tokens.
 * Colors are exposed to NativeWind as CSS variables (see tailwind.config.js) and to
 * imperative code (icons, gradients, animated styles) through `useTheme()`.
 */

export type ColorScheme = 'dark' | 'light';
export type ThemePreference = 'system' | ColorScheme;

export interface Palette {
  bg: string;
  surface: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  onAccent: string;
  ethical: string;
  unethical: string;
  streak: string;
}

export const PALETTES: Record<ColorScheme, Palette> = {
  dark: {
    bg: '#0B1120',
    surface: '#111827',
    card: '#1E293B',
    border: '#334155',
    text: '#F8FAFC',
    muted: '#94A3B8',
    accent: '#2DD4BF',
    accent2: '#38BDF8',
    onAccent: '#042F2A',
    ethical: '#22C55E',
    unethical: '#EF4444',
    streak: '#F59E0B',
  },
  light: {
    bg: '#F1F5F9',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    border: '#E2E8F0',
    text: '#0F172A',
    muted: '#475569',
    accent: '#0D9488',
    accent2: '#0284C7',
    onAccent: '#FFFFFF',
    ethical: '#15803D',
    unethical: '#DC2626',
    streak: '#B45309',
  },
};

const CSS_VAR_NAMES: Record<keyof Palette, string> = {
  bg: '--color-bg',
  surface: '--color-surface',
  card: '--color-card',
  border: '--color-border',
  text: '--color-text',
  muted: '--color-muted',
  accent: '--color-accent',
  accent2: '--color-accent2',
  onAccent: '--color-on-accent',
  ethical: '--color-ethical',
  unethical: '--color-unethical',
  streak: '--color-streak',
};

function hexToRgbChannels(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** CSS variable map for NativeWind `vars()`. */
export function paletteToCssVars(palette: Palette): Record<string, string> {
  const out: Record<string, string> = {};
  (Object.keys(CSS_VAR_NAMES) as (keyof Palette)[]).forEach((key) => {
    out[CSS_VAR_NAMES[key]] = hexToRgbChannels(palette[key]);
  });
  return out;
}

/** Adds alpha to a hex color: withAlpha('#22C55E', 0.2) -> 'rgba(34,197,94,0.2)'. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgbChannels(hex).split(' ');
  return `rgba(${r},${g},${b},${alpha})`;
}

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const RADII = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const TYPOGRAPHY = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  card: { fontSize: 19, lineHeight: 28, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
};

export const DURATIONS = {
  fast: 150,
  base: 250,
  slow: 400,
  swipeOut: 260,
  cardEnter: 280,
} as const;

/** Spring used when a swipe is cancelled and the card snaps back. */
export const SNAP_BACK_SPRING = { damping: 16, stiffness: 180, mass: 0.9 } as const;

/** Minimum comfortable touch target (points). */
export const MIN_TOUCH_TARGET = 48;
