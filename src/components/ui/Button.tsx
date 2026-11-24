import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { MIN_TOUCH_TARGET } from '@/config/theme.config';
import { useTheme } from '@/hooks/use-theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ethical' | 'unethical';
type Size = 'md' | 'lg';

const CONTAINER: Record<Variant, string> = {
  primary: 'bg-accent',
  secondary: 'bg-card border border-border',
  ghost: 'bg-transparent',
  danger: 'bg-unethical/15 border border-unethical/40',
  ethical: 'bg-ethical/15 border-2 border-ethical',
  unethical: 'bg-unethical/15 border-2 border-unethical',
};

const LABEL_TONE = {
  primary: 'onAccent',
  secondary: 'default',
  ghost: 'accent',
  danger: 'unethical',
  ethical: 'ethical',
  unethical: 'unethical',
} as const;

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled,
  fullWidth = true,
  className = '',
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;
  const tone = LABEL_TONE[variant];
  const iconColor =
    tone === 'onAccent' ? colors.onAccent : tone === 'default' ? colors.text : tone === 'accent' ? colors.accent : colors[tone];

  return (
    <Animated.View style={[fullWidth ? { width: '100%' } : null, animated]}>
      <View className={className}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!isDisabled, busy: loading }}
        disabled={isDisabled}
        onPressIn={(e) => {
          scale.set(withSpring(0.97, { damping: 20, stiffness: 400 }));
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          scale.set(withSpring(1, { damping: 15, stiffness: 300 }));
          onPressOut?.(e);
        }}
        style={{ minHeight: size === 'lg' ? 56 : MIN_TOUCH_TARGET }}
        className={`flex-row items-center justify-center rounded-2xl px-5 ${CONTAINER[variant]} ${isDisabled ? 'opacity-50' : ''}`}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color={iconColor} />
        ) : (
          <View className="flex-row items-center gap-2">
            {icon ? <Icon name={icon} size={size === 'lg' ? 22 : 18} color={iconColor} /> : null}
            <AppText variant={size === 'lg' ? 'heading' : 'bodyStrong'} tone={tone}>
              {label}
            </AppText>
            {iconRight ? <Icon name={iconRight} size={18} color={iconColor} /> : null}
          </View>
        )}
      </Pressable>
      </View>
    </Animated.View>
  );
}
