import { forwardRef, useState, type ComponentRef } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  secure?: boolean;
}

export type TextInputHandle = ComponentRef<typeof TextInput>;

export const TextField = forwardRef<TextInputHandle, TextFieldProps>(function TextField(
  { label, error, secure = false, ...props },
  ref,
) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(secure);
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.unethical : focused ? colors.accent : colors.border;

  return (
    <View className="gap-1.5">
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <View
        className="flex-row items-center rounded-xl bg-surface px-4"
        style={{ borderWidth: 1.5, borderColor, minHeight: 52 }}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          secureTextEntry={hidden}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={{ flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12 }}
          {...props}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={12}
            onPress={() => setHidden((h) => !h)}
          >
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="small" tone="unethical" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
});
