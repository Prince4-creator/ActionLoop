-- Allow users to edit their own display name, and allow self-service
-- account deletion / admin-initiated account removal to work cleanly.

alter table public.profiles
  add column if not exists full_name text null;

alter table public.profiles enable row level security;

-- Users can read their own profile row (admin dashboard reads use the
-- service-role client already, so this is just for the settings page).
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

-- Users can update their own name, but NOT their own role — role changes
-- must go through the service-role admin API route.
drop policy if exists "profiles_update_self_name" on public.profiles;
create policy "profiles_update_self_name"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- RLS policies can't restrict individual columns, so the UPDATE policy
-- above technically lets a user submit a role change in the same request.
-- This trigger silently reverts `role` back to its previous value unless
-- the request came in via the service-role key (used only by admin API
-- routes that have already checked isAdminUser()).
create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' and new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_role_change on public.profiles;
create trigger trg_prevent_self_role_change
  before update on public.profiles
  for each row
  execute function public.prevent_self_role_change();