-- supabase/migrations/20260720000000_add_profiles_username.sql
alter table public.profiles
  add column if not exists username text;

-- case-insensitive uniqueness, but allow nulls (existing users without one)
create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;