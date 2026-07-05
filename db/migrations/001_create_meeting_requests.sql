-- Create meeting_requests table
CREATE TABLE IF NOT EXISTS public.meeting_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  requester_email text,
  title text,
  message text,
  created_at timestamp with time zone DEFAULT now()
);

-- Optional index for faster lookups
CREATE INDEX IF NOT EXISTS idx_meeting_requests_user_id ON public.meeting_requests (user_id);
