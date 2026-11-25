import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { ENV } from '@/lib/env';
import { invokeFunction } from './admin-api';

export type InviteStatus = 'active' | 'used' | 'revoked' | 'expired';

export interface AdminInvite {
  id: string;
  note: string | null;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdBy: string | null;
  usedBy: string | null;
}

/** Lifetimes an admin can pick for a new invite, in hours (the server accepts only these). */
export const INVITE_EXPIRY_OPTIONS = [
  { value: '24', label: '1 day' },
  { value: '72', label: '3 days' },
  { value: '168', label: '7 days' },
] as const;
export type InviteExpiry = (typeof INVITE_EXPIRY_OPTIONS)[number]['value'];

const CODE_RE = /^[A-Za-z0-9_-]{22}$/;

/** Accepts a bare code or a full invite link (https://…/invite/CODE, comethical://invite/CODE, exp://…/--/invite/CODE). */
export function parseInviteCode(input: string): string | null {
  const text = input.trim();
  if (CODE_RE.test(text)) return text;
  const match = /invite\/([A-Za-z0-9_-]{22})(?:[/?#]|$)/.exec(text);
  return match?.[1] ?? null;
}

/** The link a teacher opens. Prefers the public web address so it works on any device. */
export function inviteLink(code: string): string {
  if (ENV.appUrl) return `${ENV.appUrl}/invite/${code}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/invite/${code}`;
  return Linking.createURL(`/invite/${code}`);
}

const call = <T>(action: string, body: Record<string, unknown> = {}) => invokeFunction<T>('admin-invites', action, body, 20_000);

export const inviteApi = {
  create: (expiresInHours: number, note?: string) =>
    call<{ code: string; invite: AdminInvite | null }>('create', { expiresInHours, note: note?.trim() || undefined }),
  list: () => call<{ invites: AdminInvite[] }>('list'),
  revoke: (id: string) => call<{ invite: AdminInvite | null }>('revoke', { id }),
  check: (code: string) => call<{ status: InviteStatus | 'invalid'; expiresAt?: string }>('check', { code }),
  redeem: (code: string) => call<{ result: 'ok' | 'already_admin' }>('redeem', { code }),
};
