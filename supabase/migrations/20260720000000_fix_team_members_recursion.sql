-- Fixes infinite recursion (Postgres error 42P17) in team_members RLS policy.
-- The old policy checked team_members membership by querying team_members
-- itself, which re-triggers the same policy recursively. A SECURITY DEFINER
-- function bypasses RLS for this internal check only, breaking the loop.

create schema if not exists private;

create or replace function private.is_team_member(check_team_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.team_members
    where team_id = check_team_id
      and user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_team_member(uuid) from public, anon, authenticated;
grant execute on function private.is_team_member(uuid) to authenticated;

-- Replace the recursive policy with one that uses the helper function
drop policy if exists "team_members_select_members" on public.team_members;
create policy "team_members_select_members"
  on public.team_members
  for select
  to authenticated
  using ( (select private.is_team_member(team_id)) );