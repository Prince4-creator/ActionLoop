-- Mirrors Supabase Auth's ban state (set via auth.admin.updateUserById with
-- ban_duration) onto profiles, so the admin UI can display/filter on it
-- without an extra admin API call per row, and so middleware can force out
-- an already-logged-in suspended user immediately.

alter table public.profiles
  add column if not exists banned_until timestamptz null,
  add column if not exists suspended_reason text null;

create index if not exists idx_profiles_banned_until
  on public.profiles (banned_until)
  where banned_until is not null;