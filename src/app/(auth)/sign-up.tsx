import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { AppText, Banner, Button, Screen, SegmentedControl, TextField } from '@/components/ui';
import { AuthHeader } from '@/components/ui/AuthHeader';
import type { TextInputHandle } from '@/components/ui/TextField';
import { validateEmail, validatePassword, validateUsername } from '@/features/auth/validation';
import { getSupabase } from '@/lib/supabase';
import { useAuthStore, type AccountType } from '@/stores/auth-store';

export default function SignUp() {
  const signUp = useAuthStore((s) => s.signUp);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<TextInputHandle>(null);
  const passwordRef = useRef<TextInputHandle>(null);
  const confirmRef = useRef<TextInputHandle>(null);
  const [accountType, setAccountType] = useState<AccountType>('player');
  const [adminSignupOpen, setAdminSignupOpen] = useState(true);

  // Hide the Admin option when the project has switched admin sign-ups off.
  useEffect(() => {
    let active = true;
    getSupabase()
      ?.from('app_settings')
      .select('allow_admin_signup')
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setAdminSignupOpen(data.allow_admin_signup);
        if (!data.allow_admin_signup) setAccountType('player');
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = async () => {
    if (loading) return;
    const next = {
      username: validateUsername(username),
      email: validateEmail(email),
      password: validatePassword(password),
      confirm: confirm === password ? null : 'Passwords do not match.',
    };
    setErrors(next);
    setFormError(null);
    if (Object.values(next).some(Boolean)) return;
    setLoading(true);
    try {
      const { needsConfirmation } = await signUp(email, password, username, adminSignupOpen ? accountType : 'player');
      if (needsConfirmation) setNotice('Check your inbox to confirm your email, then sign in.');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen keyboard edges={['top', 'bottom']}>
      <AuthHeader title="Create your account" subtitle="Save your progress across devices." />
      {formError ? <Banner tone="error">{formError}</Banner> : null}
      {notice ? (
        <Banner tone="info" actionLabel="Sign in" onAction={() => router.replace('/sign-in')}>
          {notice}
        </Banner>
      ) : null}
      {adminSignupOpen ? (
        <View className="gap-2">
          <AppText variant="caption" tone="muted">
            Account type
          </AppText>
          <SegmentedControl<AccountType>
            accessibilityLabel="Account type"
            value={accountType}
            onChange={setAccountType}
            options={[
              { value: 'player', label: 'Player' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
          <AppText variant="small" tone="muted">
            {accountType === 'admin'
              ? 'Admins can also generate scenarios with AI, review them, and choose which ones appear in games.'
              : 'Play scenarios, build streaks and track your progress.'}
          </AppText>
        </View>
      ) : null}
      <TextField
        label="Username"
        value={username}
        onChangeText={setUsername}
        error={errors.username}
        autoCapitalize="none"
        autoComplete="username"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
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
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <TextField
        ref={confirmRef}
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button label="Create account" size="lg" loading={loading} onPress={submit} />
      <Button label="I already have an account" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
