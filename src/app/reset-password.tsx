import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { Banner, Button, Screen, TextField } from '@/components/ui';
import { AuthHeader } from '@/components/ui/AuthHeader';
import { validatePassword } from '@/features/auth/validation';
import { getSupabase } from '@/lib/supabase';

/** Deep-link target of the password reset email (comethical://reset-password#access_token=…). */
export default function ResetPassword() {
  const url = Linking.useLinkingURL();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const tokens = useMemo(() => {
    if (!url) return null;
    const fragment = url.includes('#') ? (url.split('#')[1] ?? '') : (url.split('?')[1] ?? '');
    const params = new URLSearchParams(fragment);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    return access_token && refresh_token ? { access_token, refresh_token } : null;
  }, [url]);
  const linkError = url && !tokens ? 'This reset link is invalid or has expired. Request a new one.' : null;

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !tokens) return;
    supabase.auth
      .setSession(tokens)
      .then(({ error: e }) => (e ? setFormError('This reset link has expired. Request a new one.') : setReady(true)))
      .catch(() => setFormError('Could not verify the reset link.'));
  }, [tokens]);

  const submit = async () => {
    const supabase = getSupabase();
    if (!supabase || loading) return;
    const v = validatePassword(password);
    setError(v);
    if (v) return;
    setLoading(true);
    const { error: e } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (e) setFormError(e.message);
    else setDone(true);
  };

  return (
    <Screen keyboard edges={['top', 'bottom']}>
      <AuthHeader title="Choose a new password" subtitle="Use at least 8 characters with a letter and a number." />
      {formError || linkError ? <Banner tone="error">{formError ?? linkError}</Banner> : null}
      {done ? (
        <>
          <Banner tone="info" icon="checkmark-circle">
            Password updated.
          </Banner>
          <Button label="Continue" size="lg" onPress={() => router.replace('/')} />
        </>
      ) : (
        <>
          <TextField label="New password" value={password} onChangeText={setPassword} error={error} secure autoComplete="new-password" />
          <Button label="Update password" size="lg" loading={loading} disabled={!ready} onPress={submit} />
          <Button label="Back" variant="ghost" onPress={() => router.replace('/')} />
        </>
      )}
    </Screen>
  );
}
