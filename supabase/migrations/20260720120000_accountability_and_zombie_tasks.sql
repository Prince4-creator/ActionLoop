-- Accountability scoring + recurring "zombie task" detection

-- 1. Track when an item was actually completed, automatically, regardless
--    of which code path (kanban, admin bulk-done, API) marks it done.
alter table public.action_items
  add column if not exists completed_at timestamptz null;

create or replace function public.set_action_item_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and (old.status is distinct from 'done') then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_action_items_completed_at on public.action_items;
create trigger trg_action_items_completed_at
  before update on public.action_items
  for each row execute function public.set_action_item_completed_at();

-- 2. Recurring / "zombie" task detection via fuzzy description matching
create extension if not exists pg_trgm;

alter table public.action_items
  add column if not exists recurrence_count integer not null default 0,
  add column if not exists is_zombie boolean not null default false,
  add column if not exists previous_occurrence_id uuid null references public.action_items(id) on delete set null;

create index if not exists idx_action_items_description_trgm
  on public.action_items using gin (description gin_trgm_ops);

create index if not exists idx_action_items_is_zombie
  on public.action_items (team_id, is_zombie) where is_zombie = true;

-- Finds the closest matching *open* action item for the same assignee/team.
-- Call this right after inserting a new meeting's action items to chain
-- repeated asks into one "zombie task" trail instead of losing the history.
-- SECURITY INVOKER (default) so RLS on action_items still applies to the caller.
create or replace function public.find_similar_open_action_item(
  p_team_id uuid,
  p_assignee_email text,
  p_description text,
  p_exclude_id uuid
)
returns table (id uuid, description text, similarity real, recurrence_count integer)
language sql
stable
as $$
  select ai.id, ai.description, similarity(ai.description, p_description) as similarity, ai.recurrence_count
  from public.action_items ai
  where ai.team_id = p_team_id
    and lower(ai.assignee_email) = lower(p_assignee_email)
    and ai.status <> 'done'
    and ai.id <> p_exclude_id
    and similarity(ai.description, p_description) > 0.35
  order by similarity desc
  limit 1;
$$;

revoke all on function public.find_similar_open_action_item(uuid, text, text, uuid) from public;
grant execute on function public.find_similar_open_action_item(uuid, text, text, uuid) to authenticated, service_role;