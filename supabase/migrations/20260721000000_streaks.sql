-- Completion event ledger for per-person streaks
create table if not exists public.completion_events (
  id uuid primary key default gen_random_uuid(),
  action_item_id uuid not null references public.action_items(id) on delete cascade,
  assignee_email text not null,
  team_id uuid references public.teams(id) on delete cascade,
  due_date date,
  completed_at timestamptz not null default now(),
  was_on_time boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_completion_events_assignee on public.completion_events(assignee_email, completed_at desc);
create index if not exists idx_completion_events_team on public.completion_events(team_id);

alter table public.completion_events enable row level security;

drop policy if exists "completion_events_read_team" on public.completion_events;
create policy "completion_events_read_team"
  on public.completion_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = completion_events.team_id
        and tm.user_id = auth.uid()
    )
  );

-- Fallback insert policy for when SUPABASE_SERVICE_ROLE_KEY isn't set locally
-- (mirrors the pattern used by admin_audit_log_insert_self elsewhere in this repo)
drop policy if exists "completion_events_insert_team" on public.completion_events;
create policy "completion_events_insert_team"
  on public.completion_events
  for insert
  to authenticated
  with check (
    team_id is null
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = completion_events.team_id
        and tm.user_id = auth.uid()
    )
  );