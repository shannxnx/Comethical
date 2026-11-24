-- =============================================================================
-- COMETHICAL — initial schema
-- Scored data (XP, levels, scores, correctness) is written ONLY by Edge Functions
-- using the service role. Clients can read their own rows and edit their username.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (char_length(username) between 3 and 24 and username ~ '^[A-Za-z0-9_.-]+$'),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  total_xp integer not null default 0 check (total_xp >= 0),
  player_level integer not null default 1 check (player_level >= 1),
  highest_streak integer not null default 0 check (highest_streak >= 0),
  current_difficulty smallint not null default 2 check (current_difficulty between 1 and 10),
  total_answered integer not null default 0 check (total_answered >= 0),
  total_correct integer not null default 0 check (total_correct >= 0 and total_correct <= total_answered),
  sessions_completed integer not null default 0 check (sessions_completed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically for each new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  candidate text;
begin
  candidate := coalesce(requested, 'player_' || substr(replace(new.id::text, '-', ''), 1, 8));
  if candidate !~ '^[A-Za-z0-9_.-]{3,24}$'
     or exists (select 1 from public.profiles p where lower(p.username) = lower(candidate)) then
    candidate := 'player_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null unique check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 300),
  icon text not null default 'help-circle' check (char_length(icon) <= 40),
  color text not null default '#2DD4BF' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- scenarios
-- ---------------------------------------------------------------------------
create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references public.categories (id) on update cascade,
  scenario_text text not null check (char_length(scenario_text) between 25 and 400),
  correct_answer text not null check (correct_answer in ('ethical', 'unethical')),
  explanation text not null check (char_length(explanation) between 20 and 800),
  ethical_principles text[] not null check (cardinality(ethical_principles) between 1 and 5),
  recommended_action text check (recommended_action is null or char_length(recommended_action) <= 400),
  difficulty_score smallint not null check (difficulty_score between 1 and 10),
  difficulty_reasoning text not null default '',
  learning_objective text,
  generation_source text not null check (generation_source in ('seed', 'ai', 'manual')),
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected', 'flagged')),
  review_notes text,
  ai_model text,
  -- Observed performance, used to calibrate the AI difficulty estimate later.
  times_answered integer not null default 0 check (times_answered >= 0),
  times_correct integer not null default 0 check (times_correct >= 0 and times_correct <= times_answered),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exact-duplicate guard (near-duplicates are filtered in the generation function).
create unique index scenarios_text_unique on public.scenarios (md5(lower(regexp_replace(scenario_text, '\s+', ' ', 'g'))));
create index scenarios_status_difficulty on public.scenarios (approval_status, difficulty_score);
create index scenarios_category on public.scenarios (category_id);

create trigger scenarios_updated_at before update on public.scenarios
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- game_sessions
-- ---------------------------------------------------------------------------
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_mode text not null check (game_mode in ('classic', 'endless', 'review')),
  session_status text not null default 'active' check (session_status in ('active', 'completed', 'abandoned')),
  score integer not null default 0 check (score >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  incorrect_count integer not null default 0 check (incorrect_count >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  highest_streak integer not null default 0 check (highest_streak >= 0),
  xp_earned integer not null default 0 check (xp_earned >= 0),
  starting_difficulty smallint not null check (starting_difficulty between 1 and 10),
  current_difficulty smallint not null check (current_difficulty between 1 and 10),
  max_difficulty smallint not null check (max_difficulty between 1 and 10),
  ending_difficulty smallint check (ending_difficulty between 1 and 10),
  answers_since_adjustment integer not null default 0,
  consecutive_incorrect integer not null default 0,
  planned_length integer check (planned_length is null or planned_length > 0),
  served_scenario_ids uuid[] not null default '{}',
  category_results jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((session_status = 'active') = (completed_at is null))
);

create index game_sessions_user_started on public.game_sessions (user_id, started_at desc);
create index game_sessions_user_active on public.game_sessions (user_id) where session_status = 'active';

-- ---------------------------------------------------------------------------
-- user_answers
-- ---------------------------------------------------------------------------
create table public.user_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  game_mode text not null check (game_mode in ('classic', 'endless', 'review')),
  selected_answer text not null check (selected_answer in ('ethical', 'unethical')),
  is_correct boolean not null,
  points_earned integer not null default 0 check (points_earned >= 0),
  xp_earned integer not null default 0 check (xp_earned >= 0),
  response_ms integer not null default 0 check (response_ms between 0 and 3600000),
  difficulty_at_answer smallint not null check (difficulty_at_answer between 1 and 10),
  answered_at timestamptz not null default now(),
  -- Duplicate answer prevention: one answer per scenario per session.
  unique (session_id, scenario_id)
);

create index user_answers_user_time on public.user_answers (user_id, answered_at desc);
create index user_answers_scenario on public.user_answers (scenario_id);

-- ---------------------------------------------------------------------------
-- user_topic_stats
-- ---------------------------------------------------------------------------
create table public.user_topic_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id text not null references public.categories (id) on update cascade on delete cascade,
  total_answered integer not null default 0 check (total_answered >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  incorrect_count integer not null default 0 check (incorrect_count >= 0),
  last_practiced_at timestamptz,
  primary key (user_id, category_id),
  check (total_answered = correct_count + incorrect_count)
);

-- ---------------------------------------------------------------------------
-- user_review_items (Smart Review queue)
-- ---------------------------------------------------------------------------
create table public.user_review_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  last_selected_answer text not null check (last_selected_answer in ('ethical', 'unethical')),
  times_missed integer not null default 1 check (times_missed >= 1),
  last_missed_at timestamptz not null default now(),
  review_status text not null default 'pending' check (review_status in ('pending', 'reviewed')),
  reviewed_at timestamptz,
  primary key (user_id, scenario_id)
);

create index user_review_items_pending on public.user_review_items (user_id, review_status, last_missed_at desc);

-- ---------------------------------------------------------------------------
-- scenario_reports
-- ---------------------------------------------------------------------------
create table public.scenario_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  reason text not null check (reason in ('incorrect_answer', 'ambiguous', 'unclear', 'offensive', 'other')),
  description text check (description is null or char_length(description) <= 1000),
  review_status text not null default 'open' check (review_status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (user_id, scenario_id)
);

create index scenario_reports_open on public.scenario_reports (review_status, created_at desc);

-- ---------------------------------------------------------------------------
-- ai_generation_logs
-- ---------------------------------------------------------------------------
create table public.ai_generation_logs (
  id uuid primary key default gen_random_uuid(),
  model_identifier text not null,
  operation text not null check (operation in ('generate', 'assess', 'validate')),
  requested_count integer not null default 0 check (requested_count >= 0),
  generated_count integer not null default 0 check (generated_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  validation_status text not null check (validation_status in ('success', 'partial', 'failed')),
  error_details jsonb,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index ai_generation_logs_created on public.ai_generation_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Calibration view: AI estimate vs observed player accuracy (admin use only).
-- ---------------------------------------------------------------------------
create view public.scenario_calibration with (security_invoker = true) as
select
  s.id,
  s.category_id,
  s.difficulty_score as ai_difficulty,
  s.times_answered,
  case when s.times_answered > 0 then round(s.times_correct::numeric / s.times_answered, 3) end as observed_accuracy
from public.scenarios s
where s.approval_status = 'approved';

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.scenarios enable row level security;
alter table public.game_sessions enable row level security;
alter table public.user_answers enable row level security;
alter table public.user_topic_stats enable row level security;
alter table public.user_review_items enable row level security;
alter table public.scenario_reports enable row level security;
alter table public.ai_generation_logs enable row level security;

-- profiles: read own, update only username / avatar (column privileges below).
create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;

-- categories: public read.
create policy "categories: read" on public.categories for select to anon, authenticated using (true);
revoke insert, update, delete on public.categories from anon, authenticated;

-- scenarios: no direct client access (answers must never leak). Served via Edge Functions.
revoke all on public.scenarios from anon, authenticated;
revoke all on public.scenario_calibration from anon, authenticated;

-- game data: read own rows only; all writes go through Edge Functions (service role).
create policy "sessions: read own" on public.game_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "answers: read own" on public.user_answers
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "topic stats: read own" on public.user_topic_stats
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "review items: read own" on public.user_review_items
  for select to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.game_sessions, public.user_answers, public.user_topic_stats, public.user_review_items
  from anon, authenticated;

-- reports: players may file and read their own reports.
create policy "reports: insert own" on public.scenario_reports
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "reports: read own" on public.scenario_reports
  for select to authenticated using ((select auth.uid()) = user_id);
revoke update, delete on public.scenario_reports from anon, authenticated;

-- AI logs: service role only.
revoke all on public.ai_generation_logs from anon, authenticated;

-- =============================================================================
-- Atomic gameplay functions (service role only)
-- =============================================================================

-- Records one answer and every derived statistic in a single transaction.
-- Optimistic concurrency: fails with 'stale_session' if another answer was recorded
-- after the caller read the session.
create or replace function public.record_answer(
  p_user_id uuid,
  p_session_id uuid,
  p_scenario_id uuid,
  p_category_id text,
  p_selected text,
  p_is_correct boolean,
  p_points integer,
  p_xp integer,
  p_response_ms integer,
  p_difficulty smallint,
  p_mode text,
  p_expected_answered integer,
  p_session jsonb,
  p_adaptive boolean,
  p_marks_reviewed boolean
)
returns table (total_xp integer, highest_streak integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.game_sessions gs set
    score = (p_session ->> 'score')::integer,
    correct_count = (p_session ->> 'correct')::integer,
    incorrect_count = (p_session ->> 'incorrect')::integer,
    current_streak = (p_session ->> 'streak')::integer,
    highest_streak = (p_session ->> 'bestStreak')::integer,
    xp_earned = (p_session ->> 'xpEarned')::integer,
    current_difficulty = (p_session ->> 'difficulty')::smallint,
    max_difficulty = (p_session ->> 'maxDifficulty')::smallint,
    answers_since_adjustment = (p_session ->> 'answersSinceAdjustment')::integer,
    consecutive_incorrect = (p_session ->> 'consecutiveIncorrect')::integer,
    category_results = coalesce(p_session -> 'categoryResults', '{}'::jsonb)
  where gs.id = p_session_id
    and gs.user_id = p_user_id
    and gs.session_status = 'active'
    and gs.correct_count + gs.incorrect_count = p_expected_answered;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'stale_session' using errcode = 'P0001';
  end if;

  -- Unique (session_id, scenario_id) rejects duplicate submissions (errcode 23505).
  insert into public.user_answers (
    user_id, session_id, scenario_id, game_mode, selected_answer, is_correct,
    points_earned, xp_earned, response_ms, difficulty_at_answer
  ) values (
    p_user_id, p_session_id, p_scenario_id, p_mode, p_selected, p_is_correct,
    p_points, p_xp, greatest(0, least(p_response_ms, 3600000)), p_difficulty
  );

  insert into public.user_topic_stats as t (user_id, category_id, total_answered, correct_count, incorrect_count, last_practiced_at)
  values (p_user_id, p_category_id, 1, case when p_is_correct then 1 else 0 end, case when p_is_correct then 0 else 1 end, now())
  on conflict (user_id, category_id) do update set
    total_answered = t.total_answered + 1,
    correct_count = t.correct_count + (case when p_is_correct then 1 else 0 end),
    incorrect_count = t.incorrect_count + (case when p_is_correct then 0 else 1 end),
    last_practiced_at = now();

  if p_is_correct then
    if p_marks_reviewed then
      update public.user_review_items set review_status = 'reviewed', reviewed_at = now()
      where user_id = p_user_id and scenario_id = p_scenario_id;
    end if;
  else
    insert into public.user_review_items as r (user_id, scenario_id, last_selected_answer)
    values (p_user_id, p_scenario_id, p_selected)
    on conflict (user_id, scenario_id) do update set
      last_selected_answer = excluded.last_selected_answer,
      times_missed = r.times_missed + 1,
      last_missed_at = now(),
      review_status = 'pending',
      reviewed_at = null;
  end if;

  update public.scenarios set
    times_answered = times_answered + 1,
    times_correct = times_correct + (case when p_is_correct then 1 else 0 end)
  where id = p_scenario_id;

  return query
  update public.profiles p set
    total_xp = p.total_xp + greatest(p_xp, 0),
    total_answered = p.total_answered + 1,
    total_correct = p.total_correct + (case when p_is_correct then 1 else 0 end),
    highest_streak = greatest(p.highest_streak, (p_session ->> 'bestStreak')::integer),
    current_difficulty = case when p_adaptive then (p_session ->> 'difficulty')::smallint else p.current_difficulty end
  where p.id = p_user_id
  returning p.total_xp, p.highest_streak;
end;
$$;

create or replace function public.complete_session(
  p_user_id uuid,
  p_session_id uuid,
  p_status text,
  p_completion_xp integer
)
returns table (total_xp integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if p_status not in ('completed', 'abandoned') then
    raise exception 'invalid_status';
  end if;

  update public.game_sessions gs set
    session_status = p_status,
    completed_at = now(),
    ending_difficulty = gs.current_difficulty,
    xp_earned = gs.xp_earned + greatest(p_completion_xp, 0)
  where gs.id = p_session_id and gs.user_id = p_user_id and gs.session_status = 'active';
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'session_not_active' using errcode = 'P0001';
  end if;

  return query
  update public.profiles p set
    total_xp = p.total_xp + greatest(p_completion_xp, 0),
    sessions_completed = p.sessions_completed + (case when p_status = 'completed' then 1 else 0 end)
  where p.id = p_user_id
  returning p.total_xp;
end;
$$;

revoke execute on function public.record_answer(uuid, uuid, uuid, text, text, boolean, integer, integer, integer, smallint, text, integer, jsonb, boolean, boolean) from public, anon, authenticated;
revoke execute on function public.complete_session(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.record_answer(uuid, uuid, uuid, text, text, boolean, integer, integer, integer, smallint, text, integer, jsonb, boolean, boolean) to service_role;
grant execute on function public.complete_session(uuid, uuid, text, integer) to service_role;

-- =============================================================================
-- Player-facing read functions (scoped to auth.uid())
-- =============================================================================

-- Scenarios the player has missed, including explanations (safe: already answered).
create or replace function public.get_review_items()
returns table (
  scenario_id uuid,
  category_id text,
  scenario_text text,
  difficulty_score smallint,
  correct_answer text,
  explanation text,
  ethical_principles text[],
  recommended_action text,
  learning_objective text,
  last_selected_answer text,
  times_missed integer,
  last_missed_at timestamptz,
  review_status text,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.category_id, s.scenario_text, s.difficulty_score, s.correct_answer, s.explanation,
         s.ethical_principles, s.recommended_action, s.learning_objective,
         r.last_selected_answer, r.times_missed, r.last_missed_at, r.review_status, r.reviewed_at
  from public.user_review_items r
  join public.scenarios s on s.id = r.scenario_id
  where r.user_id = (select auth.uid())
  order by (r.review_status = 'pending') desc, r.last_missed_at desc
  limit 300;
$$;

create or replace function public.mark_review_item_reviewed(p_scenario_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_review_items
  set review_status = 'reviewed', reviewed_at = now()
  where user_id = (select auth.uid()) and scenario_id = p_scenario_id;
$$;

revoke execute on function public.get_review_items() from public, anon;
revoke execute on function public.mark_review_item_reviewed(uuid) from public, anon;
grant execute on function public.get_review_items() to authenticated;
grant execute on function public.mark_review_item_reviewed(uuid) to authenticated;
