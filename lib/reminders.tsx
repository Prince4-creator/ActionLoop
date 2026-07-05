import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import { ReminderEmail } from '@/emails/reminder-email';
import { WebClient } from '@slack/web-api';
import { getAppUrl } from '@/lib/app-url';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function formatDueDate(value: string | null) {
  if (!value) return 'No due date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

async function sendReminderEmail(
  recipientEmail: string,
  recipientName: string | null,
  meetingTitle: string,
  description: string,
  dueDate: string | null,
  meetingId: string,
  isEscalation = false
) {
  if (!resend) return;

  const verifiedRecipient = process.env.RESEND_TEST_RECIPIENT || process.env.RESEND_VERIFIED_RECIPIENT || process.env.RESEND_TO_EMAIL || 'princeboame4@gmail.com';
  const fallbackRecipient = recipientEmail === verifiedRecipient ? verifiedRecipient : verifiedRecipient;
  const toAddress = recipientEmail.includes('@example.com') ? fallbackRecipient : recipientEmail;
  const emailHtml = await render(
    <ReminderEmail
      recipientName={recipientName || 'there'}
      meetingTitle={meetingTitle}
      taskDescription={description}
      dueDate={formatDueDate(dueDate)}
      meetingUrl={`${getAppUrl()}/meetings/${meetingId}`}
      isEscalation={isEscalation}
    />
  );

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'ActionLoop <onboarding@resend.dev>',
    to: [toAddress],
    subject: isEscalation
      ? `Escalation: task still overdue in ${meetingTitle}`
      : `Reminder: ${meetingTitle} action item due soon`,
    html: emailHtml,
  });
}

async function sendSlackReminder(
  accessToken: string,
  channelId: string,
  meetingTitle: string,
  description: string,
  dueDate: string | null,
  meetingId: string,
  isEscalation = false
) {
  if (!accessToken) return;

  const web = new WebClient(accessToken);
  const dueText = dueDate ? `Due ${new Date(dueDate).toLocaleDateString()}` : 'No due date';
  const appUrl = `${getAppUrl()}/meetings/${meetingId}`;
  const text = `${isEscalation ? 'Escalation' : 'Reminder'}: ${meetingTitle}\n• ${description}\n• ${dueText}\n${appUrl}`;

  await web.chat.postMessage({
    channel: channelId,
    text,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${isEscalation ? 'Escalation' : 'Reminder'}*: ${meetingTitle}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `• ${description}\n• ${dueText}\n<${appUrl}|Open in ActionLoop>`,
        },
      },
    ],
  });
}

async function getTeamSlackSettings(supabase: Awaited<ReturnType<typeof createClient>>, teamId: string | null) {
  if (!teamId) return null;

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  try {
    const { data: teamMembers, error: teamMembersError } = await client
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId);

    if (teamMembersError) {
      console.error('[reminders] team members lookup failed', teamMembersError);
      return null;
    }

    const userIds = teamMembers?.map((member) => member.user_id).filter(Boolean) ?? [];
    if (!userIds.length) return null;

    const { data: teamSettings, error: settingsError } = await client
      .from('user_settings')
      .select('user_id, slack_access_token, slack_channel_id, nudge_preference')
      .in('user_id', userIds)
      .not('slack_access_token', 'is', null);

    if (settingsError) {
      console.error('[reminders] team settings lookup failed', settingsError);
      return null;
    }

    return teamSettings?.find((setting) => setting.slack_access_token && setting.slack_channel_id) ?? null;
  } catch (error) {
    console.error('[reminders] team settings lookup threw', error);
    return null;
  }
}

export async function sendTeamReminder({
  supabase,
  item,
  meeting,
  isEscalation = false,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  item: { id: string; description: string; assignee_email: string | null; due_date: string | null; meeting_id: string; nudges_sent?: number | null };
  meeting: { id: string; title: string | null; creator_email: string | null; team_id: string | null };
  isEscalation?: boolean;
}) {
  const assigneeEmail = item.assignee_email?.trim();
  if (!assigneeEmail) return;

  const teamSettings = await getTeamSlackSettings(supabase, meeting.team_id);
  const preference = (teamSettings?.nudge_preference as string | undefined) ?? 'email';
  const useSlack = preference === 'slack' || preference === 'both';
  const useEmail = preference === 'email' || preference === 'both' || !teamSettings?.slack_access_token || !teamSettings?.slack_channel_id;

  if (useEmail) {
    await sendReminderEmail(
      assigneeEmail,
      null,
      meeting.title || 'your meeting',
      item.description,
      item.due_date,
      meeting.id,
      isEscalation
    );
  }

  if (useSlack && teamSettings?.slack_access_token && teamSettings.slack_channel_id) {
    await sendSlackReminder(
      teamSettings.slack_access_token,
      teamSettings.slack_channel_id,
      meeting.title || 'your meeting',
      item.description,
      item.due_date,
      meeting.id,
      isEscalation
    );
  }

  return { preference, teamSettings };
}

export async function sendCreatorEscalationEmail({
  creatorEmail,
  meeting,
  item,
}: {
  creatorEmail: string;
  meeting: { id: string; title: string | null; team_id: string | null };
  item: { description: string; due_date: string | null; id: string; meeting_id: string; nudges_sent?: number | null };
}) {
  await sendReminderEmail(
    creatorEmail,
    'Creator',
    meeting.title || 'your meeting',
    item.description,
    item.due_date,
    meeting.id,
    true
  );
}
