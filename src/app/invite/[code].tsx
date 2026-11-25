import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { AppText, Banner, Button, Icon, Screen, Skeleton, Surface } from '@/components/ui';
import { withAlpha } from '@/config/theme.config';
import { inviteApi, parseInviteCode, type InviteStatus } from '@/features/admin/invite-api';
import { pendingInvite } from '@/features/admin/pending-invite';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useStatsStore } from '@/stores/stats-store';
import { toAppError } from '@/utils/errors';

const UNUSABLE: Record<Exclude<InviteStatus, 'active'> | 'invalid', string> = {
  invalid: 'This invite link is not valid. Check that you copied all of it, or ask your administrator for a new one.',
  used: 'This invite link has already been used. Each link works only once. Ask your administrator for a new one.',
  revoked: 'This invite link was cancelled by an administrator. Ask them for a new one.',
  expired: 'This invite link has expired. Ask your administrator for a new one.',
};

function formatExpiry(iso?: string): string | null {
  if (!iso) return null;
  const hours = Math.max(0, (Date.parse(iso) - Date.now()) / 3600_000);
  if (hours < 1) return 'less than an hour';
  if (hours < 48) return `${Math.floor(hours)} hour${Math.floor(hours) === 1 ? '' : 's'}`;
  return `${Math.floor(hours / 24)} days`;
}

/** Landing page for an admin invite link: sign in (or create an account), then accept to become an admin. */
export default function AcceptInvite() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  const code = parseInviteCode(String(params.code ?? ''));
  const authStatus = useAuthStore((s) => s.status);
  const hasOnboarded = useSettingsStore((s) => s.hasOnboarded);
  const isAdmin = useStatsStore((s) => s.stats?.isAdmin ?? false);
  const [status, setStatus] = useState<InviteStatus | 'invalid' | null>(code ? null : 'invalid');
  const [expiresAt, setExpiresAt] = useState<string | undefined>();
  const [checkError, setCheckError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const signedIn = authStatus === 'signedIn';

  useEffect(() => {
    if (!code || authStatus === 'demo' || authStatus === 'initializing') return;
    let active = true;
    inviteApi
      .check(code)
      .then((res) => {
        if (!active) return;
        setStatus(res.status);
        setExpiresAt(res.expiresAt);
        if (res.status !== 'active') void pendingInvite.clear();
      })
      .catch((e) => active && setCheckError(toAppError(e).message));
    return () => {
      active = false;
    };
  }, [code, authStatus]);

  useEffect(() => {
    if (!code) return;
    // Signed out: keep the code so it comes back after signing in. Signed in: it is handled here.
    if (authStatus === 'signedOut') void pendingInvite.save(code);
    if (signedIn) {
      void pendingInvite.clear();
      void useStatsStore.getState().refresh();
    }
  }, [code, authStatus, signedIn]);

  const accept = async () => {
    if (!code || accepting) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      await inviteApi.redeem(code);
      await useStatsStore.getState().refresh();
      setAccepted(true);
    } catch (e) {
      setAcceptError(toAppError(e).message);
    } finally {
      setAccepting(false);
    }
  };

  const leave = () => router.replace(signedIn ? '/home' : '/');

  let body: ReactNode;
  if (authStatus === 'demo') {
    body = <Banner tone="demo" icon="flask">Admin invites need the online version of COMETHICAL. This copy is running in local demo mode.</Banner>;
  } else if (accepted) {
    body = (
      <>
        <Banner tone="info" icon="checkmark-circle">You are now a COMETHICAL administrator. The Admin tab is ready for you.</Banner>
        <Button label="Open Admin" icon="shield-half" size="lg" onPress={() => router.replace('/admin')} />
      </>
    );
  } else if (checkError) {
    body = <Banner tone="error">{checkError}</Banner>;
  } else if (status === null || authStatus === 'initializing') {
    body = <Skeleton height={56} radius={16} />;
  } else if (status !== 'active') {
    body = <Banner tone="error">{UNUSABLE[status]}</Banner>;
  } else if (signedIn && isAdmin) {
    body = <Banner tone="info" icon="checkmark-circle">You are already an administrator, so this link was not used. It can still be given to someone else.</Banner>;
  } else if (signedIn) {
    body = (
      <>
        {acceptError ? <Banner tone="error">{acceptError}</Banner> : null}
        <Button label="Accept and become an admin" icon="shield-half" size="lg" loading={accepting} onPress={accept} />
      </>
    );
  } else {
    body = (
      <>
        <AppText tone="muted" className="text-center">
          Sign in or create an account first. You will come back here to accept the invite.
        </AppText>
        <Button label="Sign in" size="lg" onPress={() => router.push(hasOnboarded ? '/sign-in' : '/onboarding')} />
        <Button label="Create an account" variant="secondary" onPress={() => router.push(hasOnboarded ? '/sign-up' : '/onboarding')} />
      </>
    );
  }

  const expiry = status === 'active' && !accepted ? formatExpiry(expiresAt) : null;

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="items-center gap-3 pt-10">
        <View
          style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: withAlpha(colors.accent, 0.15) }}
          className="items-center justify-center"
        >
          <Icon name="shield-half" size={36} color={colors.accent} />
        </View>
        <AppText variant="title" accessibilityRole="header" className="text-center">
          Admin invite
        </AppText>
        <AppText tone="muted" className="text-center">
          You have been invited to help run COMETHICAL. Admins generate scenarios with AI, review them, and choose which ones appear in games.
        </AppText>
      </View>
      <Surface className="gap-3">
        {body}
        {expiry ? (
          <AppText variant="small" tone="muted" className="text-center">
            This link works once and expires in {expiry}.
          </AppText>
        ) : null}
      </Surface>
      {!accepted ? <Button label={signedIn ? 'Not now' : 'Back'} variant="ghost" onPress={leave} /> : null}
    </Screen>
  );
}
