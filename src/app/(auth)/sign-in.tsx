import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Banner, Button, Screen, TextField } from '@/components/ui';
import { AuthHeader } from '@/components/ui/AuthHeader';
import type { TextInputHandle } from '@/components/ui/TextField';
import { validateEmail } from '@/features/auth/validation';
import { useAuthStore } from '@/stores/auth-store';

export default function SignIn() {
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInputHandle>(null);

  const submit = async () => {
    if (loading) return;
    const next = { email: validateEmail(email), password: password ? null : 'Enter your password.' };
    setErrors(next);
    setFormError(null);
    if (next.email || next.password) return;
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen keyboard edges={['top', 'bottom']}>
      <AuthHeader title="Welcome back" subtitle="Sign in to keep your streaks and progress." />
      {formError ? <Banner tone="error">{formError}</Banner> : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secure
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Link href="/forgot-password" asChild>
        <Pressable accessibilityRole="link" hitSlop={8} className="self-end" style={{ minHeight: 40, justifyContent: 'center' }}>
          <AppText variant="bodyStrong" tone="accent">
            Forgot password?
          </AppText>
        </Pressable>
      </Link>
      <Button label="Sign in" size="lg" loading={loading} onPress={submit} />
      <View className="flex-row items-center justify-center gap-1">
        <AppText tone="muted">New to COMETHICAL?</AppText>
        <Link href="/sign-up" asChild>
          <Pressable accessibilityRole="link" hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
            <AppText variant="bodyStrong" tone="accent">
              Create an account
            </AppText>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}
