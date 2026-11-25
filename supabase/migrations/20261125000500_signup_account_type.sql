-- =============================================================================
-- Account type chosen at sign-up ("player" or "admin"), as requested by the client.
-- Admin sign-up is open while app_settings.allow_admin_signup is true. Turn it off at
-- any time without a code change:
--   update public.app_settings set allow_admin_signup = false;
-- Emails in public.admin_emails always become admins.
-- =============================================================================

create table public.app_settings (
  id boolean primary key default true check (id), -- single-row table
  allow_admin_signup boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (true) on conflict do nothing;

alter table public.app_settings enable row level security;
-- The app reads this to decide whether to show the Admin option.
create policy "app settings: read" on public.app_settings for select to anon, authenticated using (true);
revoke all on public.app_settings from anon, authenticated;
grant select on public.app_settings to anon, authenticated;
grant all on public.app_settings to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  wants_admin boolean := coalesce(new.raw_user_meta_data ->> 'account_type', 'player') = 'admin';
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
  elsif wants_admin and coalesce((select s.allow_admin_signup from public.app_settings s where s.id), false) then
    new_role := 'admin';
  end if;

  insert into public.profiles (id, username, role) values (new.id, candidate, new_role);
  return new;
end;
$$;
