import { useEffect, type ReactNode } from 'react';
import { Pressable, Switch, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { withAlpha } from '@/config/theme.config';
import { useTheme } from '@/hooks/use-theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  const initials =
    name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';
  return (
    <View
      accessibilityLabel={`Avatar for ${name}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: withAlpha(colors.accent, 0.18),
        borderWidth: 2,
        borderColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText variant="heading" tone="accent" style={{ fontSize: size * 0.38 }}>
        {initials}
      </AppText>
    </View>
  );
}

export function Chip({
  label,
  icon,
  color,
  selected,
  onPress,
}: {
  label: string;
  icon?: IconName | string;
  color?: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const tint = color ?? colors.accent;
  const content = (
    <View
      className="flex-row items-center gap-1.5 rounded-full px-3"
      style={{
        minHeight: 32,
        backgroundColor: selected ? withAlpha(tint, 0.2) : withAlpha(tint, 0.1),
        borderWidth: 1,
        borderColor: selected ? tint : 'transparent',
      }}
    >
      {icon ? <Icon name={icon} size={14} color={tint} /> : null}
      <AppText variant="caption" style={{ color: tint }}>
        {label}
      </AppText>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      {content}
    </Pressable>
  );
}

export function StatTile({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: IconName;
  color?: string;
}) {
  const { colors } = useTheme();
  const tint = color ?? colors.accent;
  return (
    <View className="flex-1 gap-2 rounded-2xl border border-border bg-card p-3.5" accessible accessibilityLabel={`${label}: ${value}`}>
      <View
        style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: withAlpha(tint, 0.15) }}
        className="items-center justify-center"
      >
        <Icon name={icon} size={18} color={tint} />
      </View>
      <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10">
      <View
        style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: withAlpha(colors.accent, 0.12) }}
        className="items-center justify-center"
      >
        <Icon name={icon} size={30} color={colors.accent} />
      </View>
      <AppText variant="heading" className="text-center">
        {title}
      </AppText>
      <AppText tone="muted" className="text-center">
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <View className="mt-2 w-full">
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

export function Skeleton({ height = 16, width = '100%', radius = 10 }: { height?: number; width?: number | `${number}%`; radius?: number }) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ height, width, borderRadius: radius, backgroundColor: colors.border }, style]}
    />
  );
}

export function ToggleRow({
  icon,
  label,
  description,
  value,
  onValueChange,
}: {
  icon: IconName;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-3 py-2" style={{ minHeight: 52 }}>
      <Icon name={icon} size={22} color={colors.muted} />
      <View className="flex-1">
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? (
          <AppText variant="small" tone="muted">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: withAlpha(colors.accent, 0.6) }}
        thumbColor={value ? colors.accent : colors.muted}
      />
    </View>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} className="flex-row gap-1 rounded-xl bg-surface p-1">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            className={`flex-1 items-center justify-center rounded-lg ${selected ? 'bg-card' : ''}`}
            style={{ minHeight: 40 }}
          >
            <AppText variant="caption" tone={selected ? 'accent' : 'muted'}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Banner({
  tone = 'info',
  icon,
  children,
  actionLabel,
  onAction,
}: {
  tone?: 'info' | 'error' | 'demo';
  icon?: IconName;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  const tint = tone === 'error' ? colors.unethical : tone === 'demo' ? colors.streak : colors.accent2;
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      className="flex-row items-center gap-3 rounded-xl px-3 py-2.5"
      style={{ backgroundColor: withAlpha(tint, 0.12), borderWidth: 1, borderColor: withAlpha(tint, 0.35) }}
    >
      <Icon name={icon ?? (tone === 'error' ? 'alert-circle' : 'information-circle')} size={20} color={tint} />
      <View className="flex-1">{typeof children === 'string' ? <AppText variant="small">{children}</AppText> : children}</View>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10} style={{ minHeight: 36, justifyContent: 'center' }}>
          <AppText variant="caption" style={{ color: tint }}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View className="mt-2 flex-row items-center justify-between">
      <AppText variant="overline" tone="muted">
        {title}
      </AppText>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}>
          <AppText variant="caption" tone="accent">
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
