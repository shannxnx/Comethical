-- =============================================================================
-- Explicit table privileges.
-- Newer Supabase projects no longer auto-grant privileges on new public tables to
-- anon / authenticated / service_role, so every grant the app relies on is listed here.
-- Row Level Security policies (in the init migration) still decide WHICH rows are visible.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- Edge Functions (service role) manage all game data.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Public catalogue.
grant select on public.categories to anon, authenticated;

-- Players read their own rows (RLS limits them to auth.uid()).
grant select on public.profiles to authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;
grant select on public.game_sessions to authenticated;
grant select on public.user_answers to authenticated;
grant select on public.user_topic_stats to authenticated;
grant select on public.user_review_items to authenticated;
grant select, insert on public.scenario_reports to authenticated;

-- Deliberately NOT granted to anon/authenticated: scenarios (answers stay server-side),
-- scenario_calibration, ai_generation_logs.
