-- Add reminder tracking fields for action items
alter table public.action_items
  add column if not exists nudges_sent integer not null default 0,
  add column if not exists last_nudged_at timestamptz null,
  add column if not exists last_nudge_error text null;

alter table public.meetings
  add column if not exists creator_email text null;

-- Optional: keep creator_email current for existing meetings if you have user email
-- update public.meetings set creator_email = (select email from auth.users where id = public.meetings.user_id) where creator_email is null;
