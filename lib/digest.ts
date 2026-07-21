import { Resend } from 'resend';
import { render } from '@react-email/render';
import { DigestEmail } from '@/emails/digest-email';
import { getAppUrl } from '@/lib/app-url';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendDigestEmail({
  to,
  meeting,
  actionItemCount,
}: {
  to: string;
  meeting: {
    id: string;
    title: string | null;
    summary: string | null;
    decision: string | null;
    notes: string | null;
    desired_outcome: string | null;
  };
  actionItemCount: number;
}) {
  if (!resend) {
    console.warn('[sendDigestEmail] RESEND_API_KEY not configured — skipping send to', to);
    return;
  }

  const isDev = process.env.NODE_ENV === 'development';
  const sendTo = isDev && process.env.RESEND_SEND_DEV_EMAILS !== 'true' && to !== 'verified@resend.dev'
    ? 'delivered@resend.dev'
    : to;

  const emailHtml = await render(
    DigestEmail({
      meetingTitle: meeting.title || 'Untitled meeting',
      summary: meeting.summary,
      decision: meeting.decision,
      notes: meeting.notes,
      desiredOutcome: meeting.desired_outcome,
      actionItemCount,
      meetingUrl: `${getAppUrl()}/meetings/${meeting.id}`,
    })
  );

  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'ActionLoop <onboarding@resend.dev>',
    to: sendTo,
    subject: `Digest: ${meeting.title || 'Untitled meeting'}`,
    html: emailHtml,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  return result;
}