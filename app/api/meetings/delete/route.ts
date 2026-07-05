import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { isAdminUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const meetingId = String(body?.meetingId ?? '');

    if (!meetingId) {
      return NextResponse.json({ error: 'meetingId is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const client = adminClient ?? supabase;

    const { data: meeting, error: meetingError } = await client
      .from('meetings')
      .select('id, user_id')
      .eq('id', meetingId)
      .maybeSingle();

    if (meetingError || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    if (meeting.user_id !== user.id && !isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: itemsError } = await client.from('action_items').delete().eq('meeting_id', meetingId);
    if (itemsError) {
      return NextResponse.json({ error: itemsError.message ?? 'Failed to delete action items' }, { status: 500 });
    }

    const { error } = await client.from('meetings').delete().eq('id', meetingId);
    if (error) {
      return NextResponse.json({ error: error.message ?? 'Failed to delete meeting' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to delete meeting' }, { status: 500 });
  }
}
