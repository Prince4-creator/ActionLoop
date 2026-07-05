import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { getTeamIdForUser } from '@/lib/teams';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const adminClient = createAdminClient();
    const client = adminClient ?? supabase;
    const teamId = user ? await getTeamIdForUser(client, user.id, user.email) : null;

    const meetingId = 'e763d0f2-3b3f-4428-ba8c-2ee53791c92a';
    const { data: meeting, error: meetingError } = await client
      .from('meetings')
      .select('id, team_id, user_id, title, summary')
      .eq('id', meetingId)
      .maybeSingle();

    return NextResponse.json({
      user,
      userError: userError?.message ?? null,
      teamId,
      meeting,
      meetingError: meetingError?.message ?? null,
      usingAdminClient: Boolean(adminClient),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
