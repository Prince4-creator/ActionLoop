-- Add notes field to meetings for shared team meeting notes and search

alter table public.meetings
  add column if not exists notes text null;
