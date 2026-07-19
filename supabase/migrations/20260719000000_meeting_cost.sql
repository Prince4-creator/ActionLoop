alter table public.meetings
  add column if not exists attendee_count integer null,
  add column if not exists avg_hourly_rate numeric(10,2) null default 75;