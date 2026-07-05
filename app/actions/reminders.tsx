'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { isAdminUser } from '@/lib/auth';
import { getTeamIdForUser } from '@/lib/teams';
import { sendTeamReminder, sendCreatorEscalationEmail } from '@/lib/reminders';

async function getReminderLimit(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from('admin_settings').select('value').eq('key', 'reminder_limit').maybeSingle();
  const parsed = Number(data?.value ?? '10');
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(100, Math.floor(parsed)) : 10;
}

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
  console.log('[reminders] sendReminders start', { userId: user.id, teamId, cutoff: cutoff.toISOString() });

  const meetingIds: string[] = [];
  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  if (teamId) {
    const { data: teamMeetings, error: teamMeetingsError } = await client
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
    ? await client
        .from('action_items')
        .select('id, description, assignee_email, due_date, meeting_id')
        .in('status', ['pending', 'overdue'])
        .in('meeting_id', meetingIds)
        .order('due_date', { ascending: true })
    : { data: [], error: null as unknown as Error };

  if (error) throw error;
  const eligibleItems = (pendingItems ?? []).filter((item) => {
    if (!item.due_date) return true;
    return new Date(item.due_date) <= cutoff;
  });

  const reminderLimit = await getReminderLimit(supabase);
  const cappedItems = eligibleItems.slice(0, reminderLimit);

  console.log('[reminders] candidates', { candidateCount: eligibleItems.length, reminderLimit, meetingIds, firstCandidates: cappedItems.slice(0, 5) });

  if (!cappedItems.length) {
    revalidatePath('/dashboard');
    return { sent: 0 };
  }

  const meetingsToLoad = Array.from(new Set(cappedItems.map((item) => item.meeting_id).filter(Boolean)));
  const { data: meetingsData } = meetingsToLoad.length
    ? await client.from('meetings').select('id, title, creator_email, team_id').in('id', meetingsToLoad)
    : { data: [] as Array<{ id: string; title: string | null; creator_email: string | null; team_id: string | null }> };

  const meetingLookup = new Map((meetingsData ?? []).map((meeting) => [meeting.id, meeting]));
  let sent = 0;

  for (const item of cappedItems) {
    const meeting = meetingLookup.get(item.meeting_id);
    if (!meeting) continue;

    try {
      await sendTeamReminder({
        supabase,
        item,
        meeting,
        isEscalation: false,
      });

      sent += 1;
    } catch (err) {
      try {
        await client
          .from('action_items')
          .update({ last_nudge_error: String((err as Error)?.message ?? 'send-failed') })
          .eq('id', item.id);
      } catch {
        // ignore update failure
      }
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/meetings');
  return { sent, reminderLimit };
}

export async function sendReminderForItem(actionItemId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  if (!isAdminUser(user)) {
    throw new Error('Only admins can send reminders');
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: item, error: itemError } = await client
    .from('action_items')
    .select('id, description, assignee_email, due_date, meeting_id, status')
    .eq('id', actionItemId)
    .maybeSingle();

  if (itemError) throw itemError;
  if (!item) throw new Error('Action item not found');
  if (item.status === 'done') return { sent: 0 };

  const { data: meeting, error: meetingError } = await client
    .from('meetings')
    .select('id, title, creator_email, team_id')
    .eq('id', item.meeting_id)
    .maybeSingle();

  if (meetingError) throw meetingError;
  if (!meeting) throw new Error('Meeting not found');

  await sendTeamReminder({
    supabase: client,
    item,
    meeting,
    isEscalation: false,
  });

  revalidatePath('/dashboard');
  revalidatePath('/meetings');

  return { sent: 1 };
}

export async function scheduledSendReminders(maxRetries = 3) {
  const supabase = await createClient();
  const now = new Date();
  const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: pendingItems, error } = await supabase
    .from('action_items')
    .select('id, description, assignee_email, due_date, meeting_id')
    .in('status', ['pending', 'overdue'])
    .lte('due_date', cutoff.toISOString())
    .order('due_date', { ascending: true });

  if (error) throw error;
  if (!pendingItems?.length) return { sent: 0 };

  const meetingsToLoad = Array.from(new Set(pendingItems.map((item) => item.meeting_id).filter(Boolean)));
  const { data: meetingsData } = meetingsToLoad.length
    ? await supabase.from('meetings').select('id, title, creator_email, team_id').in('id', meetingsToLoad)
    : { data: [] as Array<{ id: string; title: string | null; creator_email: string | null; team_id: string | null }> };

  const meetingLookup = new Map((meetingsData ?? []).map((meeting) => [meeting.id, meeting]));
  let sent = 0;

  for (const item of pendingItems) {
    const meeting = meetingLookup.get(item.meeting_id);
    if (!meeting) continue;

    try {
      await sendTeamReminder({
        supabase,
        item,
        meeting,
        isEscalation: false,
      });

      sent += 1;
    } catch (err) {
      try {
        await supabase
          .from('action_items')
          .update({ last_nudge_error: String((err as Error)?.message ?? 'send-failed') })
          .eq('id', item.id);
      } catch {
        // ignore update failure
      }
    }
  }

  return { sent };
}
