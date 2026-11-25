import { useState } from 'react';
import { Alert, Platform, Share, View } from 'react-native';

import { AppText, Button, Chip, SegmentedControl, Skeleton, Surface, TextField } from '@/components/ui';
import {
  INVITE_EXPIRY_OPTIONS,
  inviteApi,
  inviteLink,
  type AdminInvite,
  type InviteExpiry,
  type InviteStatus,
} from '@/features/admin/invite-api';
import { useTheme } from '@/hooks/use-theme';
import { useAdminStore } from '@/stores/admin-store';
import { toAppError } from '@/utils/errors';

const STATUS_LABEL: Record<InviteStatus, string> = { active: 'Waiting', used: 'Used', revoked: 'Revoked', expired: 'Expired' };

function when(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

/** Admin accounts are invite-only: create one-time links that expire, and see what happened to them. */
export function InvitesSection() {
  const { colors } = useTheme();
  const invites = useAdminStore((s) => s.invites);
  const loading = useAdminStore((s) => s.invitesLoading);
  const busy = useAdminStore((s) => s.busy);
  const [expiry, setExpiry] = useState<InviteExpiry>('72');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ link: string; note: string | null; expiresAt: string | null } | null>(null);

  const statusColor: Record<InviteStatus, string> = {
    active: colors.accent,
    used: colors.ethical,
    revoked: colors.muted,
    expired: colors.streak,
  };

  const create = async () => {
    if (creating) return;
    setCreating(true);
    useAdminStore.setState({ error: null, notice: null });
    try {
      const res = await inviteApi.create(Number(expiry), note);
      setCreated({ link: inviteLink(res.code), note: res.invite?.note ?? null, expiresAt: res.invite?.expiresAt ?? null });
      setNote('');
      if (res.invite) useAdminStore.setState((st) => ({ invites: [res.invite as AdminInvite, ...st.invites] }));
    } catch (e) {
      useAdminStore.setState({ error: toAppError(e).message });
    } finally {
      setCreating(false);
    }
  };

  const share = async (link: string) => {
    const message = `You're invited to be a COMETHICAL admin. Open this link to accept (it works once): ${link}`;
    try {
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? navigator : undefined;
        if (nav?.share) await nav.share({ title: 'COMETHICAL admin invite', text: message });
        else if (nav?.clipboard) {
          await nav.clipboard.writeText(link);
          useAdminStore.setState({ notice: 'Invite link copied.' });
        }
        return;
      }
      await Share.share({ title: 'COMETHICAL admin invite', message });
    } catch {
      // Share sheet dismissed: nothing to do.
    }
  };

  const revoke = (invite: AdminInvite) =>
    confirm('Revoke this invite?', 'The link will stop working. This cannot be undone.', 'Revoke', () => void useAdminStore.getState().revokeInvite(invite.id));

  return (
    <View className="gap-3">
      <AppText variant="small" tone="muted">
        Admin accounts are invite-only. Create a link and send it to the teacher. They open it, sign in or create an account, and become an admin. Each link works once and expires if it is not used.
      </AppText>

      <Surface className="gap-3">
        <TextField label="Who is it for? (optional)" value={note} onChangeText={setNote} maxLength={80} placeholder="e.g. Ms. Cruz, Grade 10" returnKeyType="done" />
        <View className="gap-2">
          <AppText variant="caption" tone="muted">
            Link expires after
          </AppText>
          <SegmentedControl<InviteExpiry> accessibilityLabel="Invite expiry" value={expiry} onChange={setExpiry} options={[...INVITE_EXPIRY_OPTIONS]} />
        </View>
        <Button label="Create invite link" icon="link" loading={creating} onPress={create} />
      </Surface>

      {created ? (
        <Surface className="gap-3" style={{ borderColor: colors.accent }}>
          <AppText variant="bodyStrong">{created.note ? `Invite for ${created.note}` : 'New invite link'}</AppText>
          <AppText variant="small" selectable style={{ color: colors.accent }}>
            {created.link}
          </AppText>
          <AppText variant="small" tone="muted">
            Copy or share it now: for security it is not shown again.
            {created.expiresAt ? ` It expires ${when(created.expiresAt)}.` : ''}
          </AppText>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button label="Share link" icon="share-outline" onPress={() => void share(created.link)} />
            </View>
            <View className="flex-1">
              <Button label="Done" variant="secondary" onPress={() => setCreated(null)} />
            </View>
          </View>
        </Surface>
      ) : null}

      <AppText variant="overline" tone="muted" className="pt-2">
        Recent invites
      </AppText>
      {loading && invites.length === 0 ? (
        <>
          <Skeleton height={72} radius={16} />
          <Skeleton height={72} radius={16} />
        </>
      ) : invites.length === 0 ? (
        <AppText tone="muted" variant="small" className="py-4 text-center">
          No invites yet.
        </AppText>
      ) : (
        invites.map((inv) => (
          <Surface key={inv.id} className="gap-1.5">
            <View className="flex-row items-center justify-between gap-2">
              <AppText variant="bodyStrong" className="flex-1" numberOfLines={1}>
                {inv.note || 'Admin invite'}
              </AppText>
              <Chip label={STATUS_LABEL[inv.status]} color={statusColor[inv.status]} />
            </View>
            <AppText variant="small" tone="muted">
              Created {when(inv.createdAt)}
              {inv.createdBy ? ` by ${inv.createdBy}` : ''}
            </AppText>
            <AppText variant="small" tone="muted">
              {inv.status === 'used'
                ? `Used ${when(inv.usedAt)}${inv.usedBy ? ` by ${inv.usedBy}` : ''}`
                : inv.status === 'revoked'
                  ? `Revoked ${when(inv.revokedAt)}`
                  : inv.status === 'expired'
                    ? `Expired ${when(inv.expiresAt)}`
                    : `Expires ${when(inv.expiresAt)}`}
            </AppText>
            {inv.status === 'active' ? (
              <View className="items-start pt-1">
                <Button label="Revoke" icon="close-circle" variant="danger" fullWidth={false} loading={!!busy[inv.id]} onPress={() => revoke(inv)} />
              </View>
            ) : null}
          </Surface>
        ))
      )}
    </View>
  );
}
