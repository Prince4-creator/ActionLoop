-- Allow service_role inserts for server-side operations (use with caution)
-- This migration updates RLS policies to permit inserts when auth.role() = 'service_role'.
-- Apply this in your Supabase SQL editor or via migration tool.

-- Meeting members: allow service_role to insert shares
DROP POLICY IF EXISTS "meeting owners can create shares" ON public.meeting_members;
CREATE POLICY "meeting owners or service_role can create shares"
  ON public.meeting_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      EXISTS (
        SELECT 1
        FROM public.meetings m
        WHERE m.id = meeting_id
          AND m.user_id = auth.uid()
      )
    )
    OR auth.role() = 'service_role'
  );

-- Meetings: allow service_role to create meetings
DROP POLICY IF EXISTS "meeting owners can create meetings" ON public.meetings;
CREATE POLICY "meeting owners or service_role can create meetings"
  ON public.meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR auth.role() = 'service_role'
  );

-- Action items: allow service_role to insert when associated meeting belongs to user
DROP POLICY IF EXISTS "action items can be inserted by meeting owners" ON public.action_items;
CREATE POLICY "action items can be inserted by meeting owners or service_role"
  ON public.action_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      EXISTS (
        SELECT 1
        FROM public.meetings m
        WHERE m.id = action_items.meeting_id
          AND m.user_id = auth.uid()
      )
    )
    OR auth.role() = 'service_role'
  );

-- Meeting_members: also allow service_role
DROP POLICY IF EXISTS "meeting owners can create shares" ON public.meeting_members;
CREATE POLICY "meeting members or service_role can create shares"
  ON public.meeting_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      EXISTS (
        SELECT 1
        FROM public.meetings m
        WHERE m.id = meeting_id
          AND m.user_id = auth.uid()
      )
    )
    OR auth.role() = 'service_role'
  );
