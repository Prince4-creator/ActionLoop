-- supabase/migrations/20260721000000_team_members_owner_delete_update.sql

create or replace function private.is_team_owner(check_team_id uuid)
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
      and role = 'owner'
  );
$$;

revoke execute on function private.is_team_owner(uuid) from public, anon, authenticated;
grant execute on function private.is_team_owner(uuid) to authenticated;

drop policy if exists "team_members_delete_owner" on public.team_members;
create policy "team_members_delete_owner"
  on public.team_members
  for delete
  to authenticated
  using ( (select private.is_team_owner(team_id)) );

drop policy if exists "team_members_update_owner" on public.team_members;
create policy "team_members_update_owner"
  on public.team_members
  for update
  to authenticated
  using ( (select private.is_team_owner(team_id)) )
  with check ( (select private.is_team_owner(team_id)) );