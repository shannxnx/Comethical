import { router } from 'expo-router';
import { useState } from 'react';

import { Banner, Button, Screen, TextField } from '@/components/ui';
import { AuthHeader } from '@/components/ui/AuthHeader';
import { validateEmail } from '@/features/auth/validation';
import { useAuthStore } from '@/stores/auth-store';

export default function ForgotPassword() {
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    const v = validateEmail(email);
    setError(v);
    setFormError(null);
    if (v) return;
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not send the reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen keyboard edges={['top', 'bottom']}>
      <AuthHeader title="Reset your password" subtitle="We will email you a link to choose a new password." />
      {formError ? <Banner tone="error">{formError}</Banner> : null}
      {sent ? (
        <Banner tone="info" icon="mail">
          If an account exists for that email, a reset link is on its way. Open it on this device.
        </Banner>
      ) : (
        <>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={error}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="send"
            onSubmitEditing={submit}
          />
          <Button label="Send reset link" size="lg" loading={loading} onPress={submit} />
        </>
      )}
      <Button label="Back to sign in" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
