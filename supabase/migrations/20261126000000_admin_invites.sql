-- =============================================================================
-- Admin accounts by invite only.
-- The Player / Admin choice on the sign-up screen is gone: every new account is a
-- player. An existing admin creates a one-time invite link in the Admin tab; whoever
-- opens it (signed in, or after signing in / creating an account) becomes an admin.
-- Each invite works once and expires if it is not used in time.
-- Emails in public.admin_emails still become admins automatically (the software admin).
-- =============================================================================

-- Sign-up no longer reads account_type: new accounts are players unless their email
-- is in admin_emails.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  candidate text;
  new_role text := 'player';
begin
  candidate := coalesce(requested, 'player_' || substr(replace(new.id::text, '-', ''), 1, 8));
  if candidate !~ '^[A-Za-z0-9_.-]{3,24}$'
     or exists (select 1 from public.profiles p where lower(p.username) = lower(candidate)) then
    candidate := 'player_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  if exists (select 1 from public.admin_emails a where a.email = lower(new.email)) then
    new_role := 'admin';
  end if;
  insert into public.profiles (id, username, role) values (new.id, candidate, new_role);
  return new;
end;
$$;

-- The open admin sign-up switch is no longer used.
drop table if exists public.app_settings;

create table public.admin_invites (
  id uuid primary key default gen_random_uuid(),
  -- SHA-256 of the invite code (hex). The code itself is shown once and never stored.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  note text check (note is null or char_length(note) <= 80),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  check (expires_at > created_at)
);
create index admin_invites_created on public.admin_invites (created_at desc);

-- Only the admin-invites Edge Function (service role) touches invites.
alter table public.admin_invites enable row level security;
revoke all on public.admin_invites from anon, authenticated;
grant all on public.admin_invites to service_role;

-- Uses an invite atomically: it is marked used and the account promoted in one step,
-- so a link can never be used twice, even by two people at the same moment.
-- Returns 'ok', 'already_admin', 'invalid', 'used', 'revoked' or 'expired'.
create or replace function public.redeem_admin_invite(p_token_hash text, p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.admin_invites%rowtype;
begin
  select * into inv from public.admin_invites where token_hash = p_token_hash for update;
  if not found then return 'invalid'; end if;
  if inv.used_at is not null then
    return case when inv.used_by = p_user then 'already_admin' else 'used' end;
  end if;
  if inv.revoked_at is not null then return 'revoked'; end if;
  if inv.expires_at <= now() then return 'expired'; end if;
  if exists (select 1 from public.profiles p where p.id = p_user and p.role = 'admin') then
    -- Already an admin: leave the invite unused so it can still go to someone else.
    return 'already_admin';
  end if;

  update public.admin_invites set used_by = p_user, used_at = now() where id = inv.id;
  update public.profiles set role = 'admin' where id = p_user;
  if not found then raise exception 'profile not found'; end if;
  return 'ok';
end;
$$;
revoke all on function public.redeem_admin_invite(text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_admin_invite(text, uuid) to service_role;
