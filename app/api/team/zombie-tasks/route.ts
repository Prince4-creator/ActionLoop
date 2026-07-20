import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { isAdminUser } from '@/lib/auth';
import { getTeamIdForUser } from '@/lib/teams';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const teamIdParam = searchParams.get('teamId');
  const teamId = teamIdParam || (await getTeamIdForUser(supabase, user.id, user.email));
  if (!teamId) return NextResponse.json({ error: 'No team found' }, { status: 404 });

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: meetings, error: meetingsError } = await client
    .from('meetings')
    .select('id, title')
    .eq('team_id', teamId);

  if (meetingsError) return NextResponse.json({ error: meetingsError.message }, { status: 500 });

  const meetingIds = (meetings ?? []).map((m) => m.id);
  const meetingTitleById = new Map((meetings ?? []).map((m) => [m.id, m.title]));

  if (!meetingIds.length) return NextResponse.json({ zombies: [] });

  const { data: zombies, error } = await client
    .from('action_items')
    .select('id, description, assignee_email, due_date, status, recurrence_count, meeting_id, created_at')
    .in('meeting_id', meetingIds)
    .eq('is_zombie', true)
    .order('recurrence_count', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = (zombies ?? []).map((z) => ({
    ...z,
    meeting_title: meetingTitleById.get(z.meeting_id) ?? null,
  }));

  return NextResponse.json({ zombies: enriched });
}