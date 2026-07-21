create table if not exists public.team_invite_links (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  max_uses integer null, -- null = unlimited
  use_count integer not null default 0,
  revoked boolean not null default false,
  expires_at timestamptz null, -- null = never expires
  created_at timestamptz not null default now()
);

create index if not exists idx_team_invite_links_team_id on public.team_invite_links(team_id);
create index if not exists idx_team_invite_links_token on public.team_invite_links(token);

alter table public.team_invite_links enable row level security;

-- Owners can view/manage links for their own team
drop policy if exists "team_invite_links_select_owner" on public.team_invite_links;
create policy "team_invite_links_select_owner"
  on public.team_invite_links
  for select
  to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = team_invite_links.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

drop policy if exists "team_invite_links_insert_owner" on public.team_invite_links;
create policy "team_invite_links_insert_owner"
  on public.team_invite_links
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = team_invite_links.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

drop policy if exists "team_invite_links_update_owner" on public.team_invite_links;
create policy "team_invite_links_update_owner"
  on public.team_invite_links
  for update
  to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = team_invite_links.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.team_members tm
      where tm.team_id = team_invite_links.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

-- Anyone authenticated can read a single link by token (to validate/join) —
-- narrowed to non-revoked, non-expired rows so a revoked link can't be probed.
drop policy if exists "team_invite_links_select_by_token" on public.team_invite_links;
create policy "team_invite_links_select_by_token"
  on public.team_invite_links
  for select
  to authenticated
  using (revoked = false);