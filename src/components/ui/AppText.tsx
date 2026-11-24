import { Text, type TextProps } from 'react-native';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'overline';
type Tone = 'default' | 'muted' | 'accent' | 'ethical' | 'unethical' | 'streak' | 'onAccent';

const VARIANTS: Record<Variant, string> = {
  display: 'text-3xl font-extrabold tracking-tight',
  title: 'text-2xl font-bold tracking-tight',
  heading: 'text-lg font-bold',
  body: 'text-base',
  bodyStrong: 'text-base font-semibold',
  small: 'text-sm',
  caption: 'text-xs font-semibold',
  overline: 'text-xs font-bold uppercase tracking-widest',
};

const TONES: Record<Tone, string> = {
  default: 'text-text',
  muted: 'text-muted',
  accent: 'text-accent',
  ethical: 'text-ethical',
  unethical: 'text-unethical',
  streak: 'text-streak',
  onAccent: 'text-on-accent',
};

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  className?: string;
}

export function AppText({ variant = 'body', tone = 'default', className = '', ...props }: AppTextProps) {
  return <Text {...props} className={`${VARIANTS[variant]} ${TONES[tone]} ${className}`} maxFontSizeMultiplier={1.6} />;
}
