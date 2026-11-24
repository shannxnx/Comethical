/**
 * Colors are CSS variables so the theme (dark / light) can switch at runtime.
 * Their values live in src/config/theme.config.ts and are applied with NativeWind `vars()`
 * at the root of the app (see src/components/ui/ThemeRoot.tsx).
 */
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Theme switching uses CSS variables (ThemeRoot), not dark: variants.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        card: token('card'),
        border: token('border'),
        text: token('text'),
        muted: token('muted'),
        accent: token('accent'),
        accent2: token('accent2'),
        'on-accent': token('on-accent'),
        ethical: token('ethical'),
        unethical: token('unethical'),
        streak: token('streak'),
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
        '3xl': '28px',
      },
      fontSize: {
        xs: ['12px', '16px'],
        sm: ['14px', '20px'],
        base: ['16px', '24px'],
        lg: ['18px', '26px'],
        xl: ['21px', '28px'],
        '2xl': ['26px', '32px'],
        '3xl': ['32px', '38px'],
      },
    },
  },
  plugins: [],
};
