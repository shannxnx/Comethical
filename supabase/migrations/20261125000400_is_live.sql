-- Derived "is_live" flag (approved AND switched on) so the admin Library can list
-- live scenarios first and switched-off / unapproved ones at the bottom.
alter table public.scenarios
  add column is_live boolean generated always as (approval_status = 'approved' and in_game) stored;

create index scenarios_library_order on public.scenarios (is_live desc, created_at desc);
