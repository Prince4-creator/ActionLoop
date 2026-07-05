-- Fix schema by adding missing columns needed for reminders and team features
-- Run this in your Supabase SQL Editor if previous migrations didn't apply

-- Add reminder tracking columns to action_items
alter table public.action_items
  add column if not exists nudges_sent integer not null default 0,
  add column if not exists last_nudged_at timestamptz null,
  add column if not exists last_nudge_error text null;

-- Add creator email tracking to meetings
alter table public.meetings
  add column if not exists creator_email text null;

-- Add team support to action items (if not already present)
alter table public.action_items
  add column if not exists team_id uuid references public.teams(id) on delete cascade;

-- Add index for team queries
create index if not exists idx_action_items_team_id on public.action_items(team_id);
