alter table public.action_items
  add column if not exists previous_occurrence_id uuid references public.action_items(id) on delete set null,
  add column if not exists recurrence_count integer not null default 1,
  add column if not exists is_zombie boolean not null default false;

create index if not exists idx_action_items_previous_occurrence on public.action_items(previous_occurrence_id);
create index if not exists idx_action_items_is_zombie on public.action_items(is_zombie) where is_zombie = true;