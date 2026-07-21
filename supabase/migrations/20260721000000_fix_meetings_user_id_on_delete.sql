-- Fix account deletion: meetings.user_id had a foreign key to auth.users
-- with no ON DELETE behavior, so Postgres blocked deleting any user who
-- had created at least one meeting (error 23503). This surfaced in the app
-- as a confusing AuthRetryableFetchError from supabase-js's auth admin API,
-- which wraps low-level Postgres errors poorly.
--
-- Fix: allow user_id to go null, and set it to null automatically when the
-- owning user is deleted, instead of blocking deletion. The meeting itself
-- (and its action items, shared members, team association) is preserved —
-- only the "creator" pointer is cleared.

alter table public.meetings
  alter column user_id drop not null;

alter table public.meetings
  drop constraint if exists meetings_user_id_fkey;

alter table public.meetings
  add constraint meetings_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete set null;