// Admin invites: the only way to get an admin account.
// Admin actions (profiles.role = 'admin'): create · list · revoke
// Anyone with a code: check (no sign-in needed, says whether the code can still be used)
// Signed-in user with a code: redeem (becomes an admin; each code works once)
// Codes are random, shown once to the admin who creates them, and stored only as SHA-256 hashes.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { HttpError, isUuid, json, readJson, serve } from '../_shared/http.ts';
import { adminClient, requireAdminUser, requireUser } from '../_shared/supabase.ts';

/** Allowed lifetimes, in hours. */
const EXPIRY_HOURS = [24, 72, 168] as const;
const DEFAULT_EXPIRY_HOURS = 72;
const CODE_RE = /^[A-Za-z0-9_-]{22}$/;
/** Active (unused, unexpired, unrevoked) invites allowed per admin at once. */
const MAX_ACTIVE_PER_ADMIN = 20;

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16)); // 128 bits
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hashCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function readCode(body: Record<string, unknown>): string {
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!CODE_RE.test(code)) throw new HttpError(400, 'invalid_invite', 'This invite link is not valid. Check that you copied all of it.');
  return code;
}

type InviteRow = {
  id: string;
  note: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  creator: { username: string } | null;
  redeemer: { username: string } | null;
};

function statusOf(r: Pick<InviteRow, 'used_at' | 'revoked_at' | 'expires_at'>): 'active' | 'used' | 'revoked' | 'expired' {
  if (r.used_at) return 'used';
  if (r.revoked_at) return 'revoked';
  if (Date.parse(r.expires_at) <= Date.now()) return 'expired';
  return 'active';
}

function toInvite(r: InviteRow) {
  return {
    id: r.id,
    note: r.note,
    status: statusOf(r),
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    usedAt: r.used_at,
    revokedAt: r.revoked_at,
    createdBy: r.creator?.username ?? null,
    usedBy: r.redeemer?.username ?? null,
  };
}

const INVITE_COLUMNS =
  'id, note, created_at, expires_at, used_at, revoked_at, creator:profiles!admin_invites_created_by_fkey(username), redeemer:profiles!admin_invites_used_by_fkey(username)';

async function loadInvite(admin: SupabaseClient, id: string) {
  const { data, error } = await admin.from('admin_invites').select(INVITE_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new HttpError(500, 'db_error', error.message);
  return data ? toInvite(data as unknown as InviteRow) : null;
}

// ── admin actions ───────────────────────────────────────────────────────────

async function create(admin: SupabaseClient, userId: string, body: Record<string, unknown>) {
  const hours = EXPIRY_HOURS.find((h) => h === Number(body.expiresInHours)) ?? DEFAULT_EXPIRY_HOURS;
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 80) : null;

  const { count, error: countError } = await admin
    .from('admin_invites')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', userId)
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString());
  if (countError) throw new HttpError(500, 'db_error', countError.message);
  if ((count ?? 0) >= MAX_ACTIVE_PER_ADMIN) {
    throw new HttpError(429, 'too_many_invites', `You already have ${MAX_ACTIVE_PER_ADMIN} unused invites. Revoke some before creating more.`);
  }

  const code = newCode();
  const { data, error } = await admin
    .from('admin_invites')
    .insert({
      token_hash: await hashCode(code),
      note,
      created_by: userId,
      expires_at: new Date(Date.now() + hours * 3600_000).toISOString(),
    })
    .select('id')
    .single();
  if (error) throw new HttpError(500, 'db_error', error.message);
  // The code is returned only here. It cannot be shown again later.
  return { code, invite: await loadInvite(admin, data.id as string) };
}

async function list(admin: SupabaseClient) {
  const { data, error } = await admin.from('admin_invites').select(INVITE_COLUMNS).order('created_at', { ascending: false }).limit(50);
  if (error) throw new HttpError(500, 'db_error', error.message);
  return { invites: (data ?? []).map((r) => toInvite(r as unknown as InviteRow)) };
}

async function revoke(admin: SupabaseClient, body: Record<string, unknown>) {
  if (!isUuid(body.id)) throw new HttpError(400, 'invalid_request', '"id" must be a UUID.');
  const { error } = await admin
    .from('admin_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', body.id)
    .is('used_at', null)
    .is('revoked_at', null);
  if (error) throw new HttpError(500, 'db_error', error.message);
  return { invite: await loadInvite(admin, body.id) };
}

// ── invitee actions ─────────────────────────────────────────────────────────

async function check(admin: SupabaseClient, body: Record<string, unknown>) {
  const code = readCode(body);
  const { data, error } = await admin
    .from('admin_invites')
    .select('used_at, revoked_at, expires_at')
    .eq('token_hash', await hashCode(code))
    .maybeSingle();
  if (error) throw new HttpError(500, 'db_error', error.message);
  if (!data) return { status: 'invalid' as const };
  return { status: statusOf(data as InviteRow), expiresAt: data.expires_at };
}

const REDEEM_ERRORS: Record<string, [number, string]> = {
  invalid: [404, 'This invite link is not valid. Ask your administrator for a new one.'],
  used: [409, 'This invite link has already been used. Ask your administrator for a new one.'],
  revoked: [410, 'This invite link was cancelled. Ask your administrator for a new one.'],
  expired: [410, 'This invite link has expired. Ask your administrator for a new one.'],
};

async function redeem(admin: SupabaseClient, req: Request, body: Record<string, unknown>) {
  const user = await requireUser(req, admin);
  const code = readCode(body);
  const { data, error } = await admin.rpc('redeem_admin_invite', { p_token_hash: await hashCode(code), p_user: user.id });
  if (error) throw new HttpError(500, 'db_error', error.message);
  const outcome = String(data);
  if (outcome === 'ok' || outcome === 'already_admin') return { result: outcome };
  const [status, message] = REDEEM_ERRORS[outcome] ?? [400, 'This invite link cannot be used.'];
  throw new HttpError(status, `invite_${outcome}`, message);
}

serve(async (req) => {
  const admin = adminClient();
  const body = await readJson(req);
  switch (body.action) {
    case 'check':
      return json(await check(admin, body));
    case 'redeem':
      return json(await redeem(admin, req, body));
    case 'create':
      return json(await create(admin, (await requireAdminUser(req, admin)).id, body));
    case 'list':
      await requireAdminUser(req, admin);
      return json(await list(admin));
    case 'revoke':
      await requireAdminUser(req, admin);
      return json(await revoke(admin, body));
    default:
      throw new HttpError(400, 'invalid_request', 'Unknown action.');
  }
});
