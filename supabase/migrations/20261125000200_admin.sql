-- =============================================================================
-- Admin role + scenario review metadata.
-- Admins can generate (Gemini), edit, approve, reject and delete scenarios through the
-- admin-scenarios Edge Function. The role is never writable by clients.
-- =============================================================================

alter table public.profiles
  add column role text not null default 'player' check (role in ('player', 'admin'));

-- Emails that become admins automatically (now, and when they sign up later).
create table public.admin_emails (
  email text primary key check (email = lower(email))
);
alter table public.admin_emails enable row level security;
revoke all on public.admin_emails from anon, authenticated;
grant all on public.admin_emails to service_role;

insert into public.admin_emails (email) values ('software.engineer.group1@gmail.com')
on conflict do nothing;

-- Promote existing accounts.
update public.profiles p set role = 'admin'
from auth.users u
where u.id = p.id and lower(u.email) in (select email from public.admin_emails);

-- Promote future sign-ups.
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

-- Review metadata on scenarios.
alter table public.scenarios
  add column difficulty_factors jsonb,
  add column admin_instructions text check (admin_instructions is null or char_length(admin_instructions) <= 1000),
  add column created_by uuid references public.profiles (id) on delete set null,
  add column reviewed_by uuid references public.profiles (id) on delete set null,
  add column reviewed_at timestamptz;

create index scenarios_status_created on public.scenarios (approval_status, created_at desc);

-- Admin generations have their own, more generous hourly budget.
alter table public.ai_generation_logs
  add column requested_by uuid references public.profiles (id) on delete set null;
