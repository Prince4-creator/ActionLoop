-- Add reminder tracking fields for action items and creator email to meetings

alter table public.action_items
  add column if not exists nudges_sent integer not null default 0,
  add column if not exists last_nudged_at timestamptz null,
  add column if not exists last_nudge_error text null;

alter table public.meetings
  add column if not exists creator_email text null;
