import { createAdminClient } from '@/lib/admin';
import { NextResponse } from 'next/server';

// Helper to execute raw SQL
async function executeSql(adminClient: any, sql: string) {
  // Supabase admin client doesn't have direct SQL exec, but we can use the REST API
  // For now, return instructions to user
  return null;
}

export async function POST() {
  return NextResponse.json({
    success: false,
    message: 'Please run the following SQL in your Supabase dashboard SQL Editor:',
    sql: `
CREATE TABLE IF NOT EXISTS public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  UNIQUE(team_id, email)
);

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invites for their teams" ON public.team_invites;
DROP POLICY IF EXISTS "Team owners can create invites" ON public.team_invites;
DROP POLICY IF EXISTS "Invitees can accept invites" ON public.team_invites;

CREATE POLICY "Users can view invites for their teams"
  ON public.team_invites
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = team_invites.team_id
        AND tm.user_id = auth.uid()
    )
    OR invited_by = auth.uid()
  );

CREATE POLICY "Team owners can create invites"
  ON public.team_invites
  FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = team_invites.team_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
    )
  );

CREATE POLICY "Invitees can accept invites"
  ON public.team_invites
  FOR UPDATE
  USING (email = auth.jwt() ->> 'email')
  WITH CHECK (email = auth.jwt() ->> 'email');

CREATE INDEX IF NOT EXISTS idx_team_invites_team_id ON public.team_invites(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON public.team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON public.team_invites(token);
CREATE INDEX IF NOT EXISTS idx_team_invites_status ON public.team_invites(status);
    `,
  });
}

