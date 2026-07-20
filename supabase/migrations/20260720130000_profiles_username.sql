-- Add username support to profiles, used for matching meeting-transcript
-- assignees by spoken name instead of guessed email.

alter table public.profiles
  add column if not exists username text null;

-- Case-insensitive uniqueness, but only enforced when a username is set
-- (so existing/legacy rows with no username don't collide with each other).
create unique index if not exists idx_profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

-- Ensure RLS is on and users can update their own profile row (needed for
-- the upsert() call in the sign-up flow). "using (true)" on select preserves
-- the existing behavior in app/admin/page.tsx, which lists all profiles for
-- any authenticated session — tighten this later if that's broader than you want.
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all_authenticated" on public.profiles;
create policy "profiles_select_all_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());