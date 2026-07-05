create table if not exists public.meeting_members (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  email text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (meeting_id, email)
);

alter table public.meeting_members enable row level security;

create index if not exists meeting_members_meeting_id_idx on public.meeting_members (meeting_id);
create index if not exists meeting_members_email_idx on public.meeting_members (lower(email));

drop policy if exists "meeting members can read their shares" on public.meeting_members;
create policy "meeting members can read their shares"
  on public.meeting_members
  for select
  to authenticated
  using (
    lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    or exists (
      select 1
      from public.meetings m
      where m.id = meeting_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "meeting owners can create shares" on public.meeting_members;
create policy "meeting owners can create shares"
  on public.meeting_members
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.meetings m
      where m.id = meeting_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "meeting owners can delete shares" on public.meeting_members;
create policy "meeting owners can delete shares"
  on public.meeting_members
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.meetings m
      where m.id = meeting_id
        and m.user_id = auth.uid()
    )
  );

alter table public.meetings enable row level security;

drop policy if exists "meetings are readable by owners and shared members" on public.meetings;
create policy "meetings are readable by owners and shared members"
  on public.meetings
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.meeting_members mm
      where mm.meeting_id = meetings.id
        and lower(mm.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    )
  );

drop policy if exists "meeting owners can create meetings" on public.meetings;
create policy "meeting owners can create meetings"
  on public.meetings
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "meeting owners can update meetings" on public.meetings;
create policy "meeting owners can update meetings"
  on public.meetings
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "meeting owners can delete meetings" on public.meetings;
create policy "meeting owners can delete meetings"
  on public.meetings
  for delete
  to authenticated
  using (user_id = auth.uid());

alter table public.action_items enable row level security;

drop policy if exists "action items are readable by meeting members" on public.action_items;
create policy "action items are readable by meeting members"
  on public.action_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.meetings m
      where m.id = action_items.meeting_id
        and (
          m.user_id = auth.uid()
          or exists (
            select 1
            from public.meeting_members mm
            where mm.meeting_id = m.id
              and lower(mm.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
          )
        )
    )
  );

drop policy if exists "action items can be inserted by meeting owners" on public.action_items;
create policy "action items can be inserted by meeting owners"
  on public.action_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.meetings m
      where m.id = action_items.meeting_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "action items can be updated by meeting owners" on public.action_items;
create policy "action items can be updated by meeting owners"
  on public.action_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.meetings m
      where m.id = action_items.meeting_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.meetings m
      where m.id = action_items.meeting_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "action items can be deleted by meeting owners" on public.action_items;
create policy "action items can be deleted by meeting owners"
  on public.action_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.meetings m
      where m.id = action_items.meeting_id
        and m.user_id = auth.uid()
    )
  );
