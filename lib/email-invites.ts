import { Resend } from 'resend';
import { TeamInviteEmail } from '@/emails/team-invite-email';
import { getAppUrl } from '@/lib/app-url';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface SendTeamInviteEmailProps {
  to: string;
  teamName: string;
  invitedByEmail: string;
  inviteToken: string;
  expiresAt: Date;
}

export async function sendTeamInviteEmail({
  to,
  teamName,
  invitedByEmail,
  inviteToken,
  expiresAt,
}: SendTeamInviteEmailProps) {
  const inviteUrl = `${getAppUrl()}/invite/${inviteToken}`;
  const isDev = process.env.NODE_ENV === 'development';
  const sendTo = isDev && process.env.RESEND_SEND_DEV_EMAILS !== 'true' && to !== 'verified@resend.dev'
    ? 'delivered@resend.dev'
    : to;

  if (isDev) {
    console.info(`Team invite preview: ${inviteUrl}`);
    console.info(`Sending invite email to: ${sendTo} (original: ${to})`);
  }

  try {
      if (!resend) {
        throw new Error('Missing Resend API key');
      }

      const result = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'ActionLoop <onboarding@resend.dev>',
        to: sendTo,
        subject: `You're invited to join "${teamName}" on ActionLoop`,
        react: TeamInviteEmail({
          teamName,
          invitedByEmail,
          inviteUrl,
          expiresAt,
        }) as React.ReactElement,
      });

      if (result.error) {
        throw new Error(`Resend error: ${result.error.message}`);
      }

      return result;
  } catch (error) {
    console.error('Failed to send team invite email:', error);
    throw error;
  }
}
