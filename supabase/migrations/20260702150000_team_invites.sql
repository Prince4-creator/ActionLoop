-- Create team_invites table for team membership invitations
create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id) on delete set null,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  unique(team_id, email)
);

-- Enable RLS
alter table public.team_invites enable row level security;

-- Policy: Anyone can view invites for their team
create policy "Users can view invites for their teams"
  on public.team_invites
  for select
  using (
    exists(
      select 1 from public.team_members tm
      where tm.team_id = team_invites.team_id
        and tm.user_id = auth.uid()
    )
    or invited_by = auth.uid()
  );

-- Policy: Team owners can create invites
create policy "Team owners can create invites"
  on public.team_invites
  for insert
  with check (
    exists(
      select 1 from public.team_members tm
      where tm.team_id = team_invites.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'owner'
    )
  );

-- Policy: Invitees can accept their own invites
create policy "Invitees can accept invites"
  on public.team_invites
  for update
  using (email = auth.jwt() ->> 'email')
  with check (email = auth.jwt() ->> 'email');

-- Create index for lookups
create index if not exists idx_team_invites_team_id on public.team_invites(team_id);
create index if not exists idx_team_invites_email on public.team_invites(email);
create index if not exists idx_team_invites_token on public.team_invites(token);
create index if not exists idx_team_invites_status on public.team_invites(status);
