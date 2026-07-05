create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique(team_id, user_id)
);

create table if not exists team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  slack_access_token text,
  slack_channel_id text,
  nudge_preference text not null default 'email',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table meetings add column if not exists team_id uuid references teams(id) on delete cascade;
create index if not exists idx_meetings_team_id on meetings(team_id);
create index if not exists idx_team_members_team_id on team_members(team_id);
create index if not exists idx_team_members_user_id on team_members(user_id);

alter table action_items add column if not exists team_id uuid references teams(id) on delete cascade;
create index if not exists idx_action_items_team_id on action_items(team_id);

alter table meetings enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_invites enable row level security;
alter table user_settings enable row level security;
alter table action_items enable row level security;

drop policy if exists "teams_select_members" on teams;
drop policy if exists "teams_insert_owner" on teams;

drop policy if exists "team_members_select_members" on team_members;
drop policy if exists "team_members_insert_self" on team_members;

drop policy if exists "meetings_select_team_members" on meetings;
drop policy if exists "meetings_insert_team_members" on meetings;
drop policy if exists "meetings_update_team_members" on meetings;

drop policy if exists "action_items_select_team_members" on action_items;
drop policy if exists "action_items_insert_team_members" on action_items;
drop policy if exists "action_items_update_team_members" on action_items;

drop policy if exists "user_settings_select_self" on user_settings;
drop policy if exists "user_settings_insert_self" on user_settings;
drop policy if exists "user_settings_update_self" on user_settings;

drop policy if exists "team_invites_manage_self" on team_invites;
drop policy if exists "team_invites_insert_owner" on team_invites;

-- =========================
-- teams
-- =========================
create policy "teams_select_members" on teams
  for select
  using (
    exists (
      select 1
      from team_members tm
      where tm.team_id = teams.id
        and tm.user_id = auth.uid()
    )
  );

create policy "teams_insert_owner" on teams
  for insert
  with check (owner_id = auth.uid());

-- =========================
-- team_members
-- =========================
create policy "team_members_select_members" on team_members
  for select
  using (
    exists (
      select 1
      from team_members tm
      where tm.team_id = team_members.team_id
        and tm.user_id = auth.uid()
    )
  );

create policy "team_members_insert_self" on team_members
  for insert
  with check (user_id = auth.uid());

-- =========================
-- team_invites
-- =========================
create policy "team_invites_manage_self" on team_invites
  for select
  using (
    invitee_email = lower((auth.jwt() ->> 'email')::text)
    or inviter_id = auth.uid()
  );

create policy "team_invites_insert_owner" on team_invites
  for insert
  with check (
    exists (
      select 1
      from team_members tm
      where tm.team_id = team_invites.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

-- =========================
-- user_settings (FIXED)
-- =========================
-- SELECT
create policy "user_settings_select_self" on user_settings
  for select
  using (user_id = auth.uid());

-- INSERT
create policy "user_settings_insert_self" on user_settings
  for insert
  with check (user_id = auth.uid());

-- UPDATE
create policy "user_settings_update_self" on user_settings
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =========================
-- meetings
-- =========================
create policy "meetings_select_team_members" on meetings
  for select
  using (
    exists (
      select 1
      from team_members tm
      where tm.team_id = meetings.team_id
        and tm.user_id = auth.uid()
    )
  );

create policy "meetings_insert_team_members" on meetings
  for insert
  with check (
    exists (
      select 1
      from team_members tm
      where tm.team_id = meetings.team_id
        and tm.user_id = auth.uid()
    )
  );

create policy "meetings_update_team_members" on meetings
  for update
  using (
    exists (
      select 1
      from team_members tm
      where tm.team_id = meetings.team_id
        and tm.user_id = auth.uid()
    )
  );

-- =========================
-- action_items
-- =========================
create policy "action_items_select_team_members" on action_items
  for select
  using (
    exists (
      select 1
      from meetings m
      join team_members tm on tm.team_id = m.team_id
      where m.id = action_items.meeting_id
        and tm.user_id = auth.uid()
    )
  );

create policy "action_items_insert_team_members" on action_items
  for insert
  with check (
    exists (
      select 1
      from meetings m
      join team_members tm on tm.team_id = m.team_id
      where m.id = action_items.meeting_id
        and tm.user_id = auth.uid()
    )
  );

create policy "action_items_update_team_members" on action_items
  for update
  using (
    exists (
      select 1
      from meetings m
      join team_members tm on tm.team_id = m.team_id
      where m.id = action_items.meeting_id
        and tm.user_id = auth.uid()
    )
  );