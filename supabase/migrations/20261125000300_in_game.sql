-- =============================================================================
-- In-game switch: a scenario is served to players only when it is
-- approval_status = 'approved' AND in_game = true. Admins can hide an approved
-- scenario without un-approving it, and bring it back with one tap.
-- =============================================================================

alter table public.scenarios
  add column in_game boolean not null default true;

create index scenarios_servable on public.scenarios (difficulty_score)
  where approval_status = 'approved' and in_game;

-- Calibration view: include the switch so hidden scenarios are easy to spot.
create or replace view public.scenario_calibration with (security_invoker = true) as
select
  s.id,
  s.category_id,
  s.difficulty_score as ai_difficulty,
  s.times_answered,
  case when s.times_answered > 0 then round(s.times_correct::numeric / s.times_answered, 3) end as observed_accuracy,
  s.in_game -- appended last: CREATE OR REPLACE VIEW can only add columns at the end
from public.scenarios s
where s.approval_status = 'approved';

revoke all on public.scenario_calibration from anon, authenticated;
grant select on public.scenario_calibration to service_role;
