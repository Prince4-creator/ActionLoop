-- Only admins may mark action items done. Regular authenticated users
-- (including the assignee) get no UPDATE policy at all for this table —
-- admin-triggered writes go through the service-role client, which
-- bypasses RLS entirely, so this is enforced primarily in application code
-- (isAdminUser check in markActionItemDone) with RLS as a hard backstop.

drop policy if exists "action_items_update_assignee_only" on public.action_items;
drop policy if exists "action_items_update_assignee_or_owner" on public.action_items;
drop policy if exists "action_items_update_team_members" on public.action_items;
drop policy if exists "action items can be updated by meeting owners" on public.action_items;

-- No SELECT-visible UPDATE policy for `authenticated` — this means a
-- non-admin's own session client can no longer update action_items at all,
-- even if application-level checks were ever bypassed.