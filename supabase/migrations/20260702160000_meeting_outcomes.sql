-- Add outcome tracking and decision fields to meetings
alter table public.meetings
  add column if not exists desired_outcome text null,
  add column if not exists decision text null,
  add column if not exists outcome_score integer not null default 0;

create index if not exists idx_meetings_desired_outcome on public.meetings(desired_outcome);
create index if not exists idx_meetings_decision on public.meetings(decision);
