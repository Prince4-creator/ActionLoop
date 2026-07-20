-- Further restrict action_items updates: only the assignee (by email match)
-- may mark their own item done. Meeting owners no longer get a bypass here —
-- admin-triggered updates go through the service-role client, which already
-- bypasses RLS entirely, so admin access doesn't need a policy clause.

drop policy if exists "action_items_update_assignee_or_owner" on public.action_items;

create policy "action_items_update_assignee_only"
  on public.action_items
  for update
  to authenticated
  using (
    assignee_email is not null
    and lower(assignee_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
  with check (
    assignee_email is not null
    and lower(assignee_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );