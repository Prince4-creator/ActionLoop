-- Fixes a second infinite-recursion cycle (42P17), this time between
-- meetings and meeting_members: the meetings SELECT policy checks
-- meeting_members, and the meeting_members SELECT policy checks meetings,
-- so each triggers the other's RLS policy forever. SECURITY DEFINER
-- helper functions break the cycle by bypassing RLS for these internal
-- ownership/sharing checks only.

create schema if not exists private;

-- True if the current user owns this meeting (bypasses meetings RLS internally)
create or replace function private.owns_meeting(p_meeting_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.meetings
    where id = p_meeting_id
      and user_id = (select auth.uid())
  );
$$;

-- True if this meeting was shared with the current user's email (bypasses meeting_members RLS internally)
create or replace function private.meeting_shared_with_me(p_meeting_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.meeting_members
    where meeting_id = p_meeting_id
      and lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );
$$;

revoke execute on function private.owns_meeting(uuid) from public, anon, authenticated;
revoke execute on function private.meeting_shared_with_me(uuid) from public, anon, authenticated;
grant execute on function private.owns_meeting(uuid) to authenticated;
grant execute on function private.meeting_shared_with_me(uuid) to authenticated;

-- ============ meetings ============
drop policy if exists "meetings are readable by owners and shared members" on public.meetings;
drop policy if exists "meetings_select_team_members" on public.meetings;
create policy "meetings_select_no_recursion"
  on public.meetings
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.meeting_shared_with_me(id))
    or (team_id is not null and (select private.is_team_member(team_id)))
  );

-- ============ meeting_members ============
drop policy if exists "meeting members can read their shares" on public.meeting_members;
create policy "meeting_members_select_no_recursion"
  on public.meeting_members
  for select
  to authenticated
  using (
    lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    or (select private.owns_meeting(meeting_id))
  );

drop policy if exists "meeting owners can create shares" on public.meeting_members;
drop policy if exists "meeting owners or service_role can create shares" on public.meeting_members;
drop policy if exists "meeting members or service_role can create shares" on public.meeting_members;
create policy "meeting_members_insert_no_recursion"
  on public.meeting_members
  for insert
  to authenticated
  with check (
    (select private.owns_meeting(meeting_id))
    or auth.role() = 'service_role'
  );

drop policy if exists "meeting owners can delete shares" on public.meeting_members;
create policy "meeting_members_delete_no_recursion"
  on public.meeting_members
  for delete
  to authenticated
  using ( (select private.owns_meeting(meeting_id)) );

-- ============ action_items ============
-- These previously re-queried meetings (and, transitively, meeting_members)
-- inline, which re-triggers the same RLS chain. Route through the helper
-- functions instead.
drop policy if exists "action items are readable by meeting members" on public.action_items;
drop policy if exists "action_items_select_team_members" on public.action_items;
create policy "action_items_select_no_recursion"
  on public.action_items
  for select
  to authenticated
  using (
    (select private.owns_meeting(meeting_id))
    or (select private.meeting_shared_with_me(meeting_id))
    or exists (
      select 1 from public.meetings m
      where m.id = action_items.meeting_id
        and m.team_id is not null
        and (select private.is_team_member(m.team_id))
    )
  );