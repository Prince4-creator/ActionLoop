-- supabase/migrations/20260721000000_fix_team_invites_invited_by_nullable.sql
alter table public.team_invites
  alter column invited_by drop not null;