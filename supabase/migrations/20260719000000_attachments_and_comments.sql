-- Attachments: metadata for files uploaded to Supabase Storage, linked to a meeting
create table if not exists public.meeting_attachments (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint not null default 0,
  content_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_meeting_attachments_meeting_id on public.meeting_attachments(meeting_id);

alter table public.meeting_attachments enable row level security;

drop policy if exists "attachments readable by meeting members" on public.meeting_attachments;
create policy "attachments readable by meeting members"
  on public.meeting_attachments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_attachments.meeting_id
        and (
          m.user_id = auth.uid()
          or exists (
            select 1 from public.meeting_members mm
            where mm.meeting_id = m.id
              and lower(mm.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
          )
          or exists (
            select 1 from public.team_members tm
            where tm.team_id = m.team_id
              and tm.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "attachments insertable by meeting members" on public.meeting_attachments;
create policy "attachments insertable by meeting members"
  on public.meeting_attachments
  for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_attachments.meeting_id
        and (
          m.user_id = auth.uid()
          or exists (
            select 1 from public.team_members tm
            where tm.team_id = m.team_id
              and tm.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "attachments deletable by uploader or meeting owner" on public.meeting_attachments;
create policy "attachments deletable by uploader or meeting owner"
  on public.meeting_attachments
  for delete
  to authenticated
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_attachments.meeting_id
        and m.user_id = auth.uid()
    )
  );

-- Comments: threaded notes on a specific action item
create table if not exists public.action_item_comments (
  id uuid primary key default gen_random_uuid(),
  action_item_id uuid not null references public.action_items(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_email text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_action_item_comments_item_id on public.action_item_comments(action_item_id);

alter table public.action_item_comments enable row level security;

drop policy if exists "comments readable by meeting members" on public.action_item_comments;
create policy "comments readable by meeting members"
  on public.action_item_comments
  for select
  to authenticated
  using (
    exists (
      select 1 from public.action_items ai
      join public.meetings m on m.id = ai.meeting_id
      where ai.id = action_item_comments.action_item_id
        and (
          m.user_id = auth.uid()
          or exists (
            select 1 from public.meeting_members mm
            where mm.meeting_id = m.id
              and lower(mm.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
          )
          or exists (
            select 1 from public.team_members tm
            where tm.team_id = m.team_id
              and tm.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "comments insertable by meeting members" on public.action_item_comments;
create policy "comments insertable by meeting members"
  on public.action_item_comments
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.action_items ai
      join public.meetings m on m.id = ai.meeting_id
      where ai.id = action_item_comments.action_item_id
        and (
          m.user_id = auth.uid()
          or exists (
            select 1 from public.team_members tm
            where tm.team_id = m.team_id
              and tm.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "comments deletable by author" on public.action_item_comments;
create policy "comments deletable by author"
  on public.action_item_comments
  for delete
  to authenticated
  using (author_id = auth.uid());