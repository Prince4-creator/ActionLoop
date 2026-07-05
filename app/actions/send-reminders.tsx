'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { isAdminUser } from '@/lib/auth';
import { getTeamIdForUser } from '@/lib/teams';
import { sendTeamReminder, sendCreatorEscalationEmail } from '@/lib/reminders';


export async function sendReminders() {

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  if (!isAdminUser(user)) {
    throw new Error('Only admins can send reminders');
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const teamId = await getTeamIdForUser(supabase, user.id, user.email);

  const meetingIds: string[] = [];
  if (teamId) {
    const { data: teamMeetings, error: teamMeetingsError } = await supabase
      .from('meetings')
      .select('id')
      .eq('team_id', teamId);

    if (teamMeetingsError) throw teamMeetingsError;
    meetingIds.push(...((teamMeetings ?? []).map((meeting) => meeting.id)));
  } else {
    const { data: userMeetings, error: userMeetingsError } = await supabase
      .from('meetings')
      .select('id')
      .eq('user_id', user.id);

    if (userMeetingsError) throw userMeetingsError;
    meetingIds.push(...((userMeetings ?? []).map((meeting) => meeting.id)));
  }

  const { data: pendingItems, error } = meetingIds.length
    ? await supabase
        .from('action_items')
        .select('id, description, assignee_email, due_date, meeting_id')
        .in('status', ['pending', 'overdue'])
        .in('meeting_id', meetingIds)
        .lte('due_date', cutoff.toISOString())
        .order('due_date', { ascending: true })
    : { data: [], error: null as unknown as Error };

  if (error) throw error;
  if (!pendingItems?.length) {
    revalidatePath('/dashboard');
    return { sent: 0 };
  }

  const meetingsToLoad = Array.from(new Set(pendingItems.map((item) => item.meeting_id).filter(Boolean)));
  const { data: meetingsData } = meetingsToLoad.length
    ? await supabase.from('meetings').select('id, title, creator_email, team_id').in('id', meetingsToLoad)
    : { data: [] as Array<{ id: string; title: string | null; creator_email: string | null; team_id: string | null }> };

  const meetingLookup = new Map((meetingsData ?? []).map((meeting) => [meeting.id, meeting]));
  let sent = 0;

  for (const item of pendingItems) {
    const meeting = meetingLookup.get(item.meeting_id);
    const meetingTitle = meeting?.title || 'your meeting';
    const meetingId = meeting?.id || item.meeting_id;

    if (!meeting) continue;

    try {
      await sendTeamReminder({
        supabase,
        item: { ...item, meeting_id: meetingId },
        meeting: { ...meeting, title: meetingTitle, team_id: teamId },
        isEscalation: false,
      });

      sent += 1;

    } catch (err) {
      await supabase
        .from('action_items')
        .update({ last_nudge_error: String((err as Error)?.message ?? 'send-failed'), last_nudged_at: new Date().toISOString() })
        .eq('id', item.id);
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/meetings');
  return { sent };
}
