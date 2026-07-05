import { Body } from '@react-email/body';
import { Button } from '@react-email/button';
import { Container } from '@react-email/container';
import { Head } from '@react-email/head';
import { Html } from '@react-email/html';
import { Preview } from '@react-email/preview';
import { Section } from '@react-email/section';
import { Text } from '@react-email/text';

interface TeamInviteEmailProps {
  teamName: string;
  invitedByEmail: string;
  inviteUrl: string;
  expiresAt: Date;
}

export const TeamInviteEmail = ({
  teamName,
  invitedByEmail,
  inviteUrl,
  expiresAt,
}: TeamInviteEmailProps) => {
  const formattedDate = expiresAt.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Html>
      <Head />
      <Preview>You've been invited to join {teamName}</Preview>
      <Body className="bg-slate-50 text-slate-900">
        <Container className="mx-auto my-10 w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <Section className="mb-6">
            <Text className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Team invitation</Text>
          </Section>
          <Section className="mb-6">
            <Text className="text-3xl font-semibold text-slate-900">You're Invited!</Text>
          </Section>
          <Section className="space-y-4">
            <Text className="text-base text-slate-700">
              <strong>{invitedByEmail}</strong> has invited you to join <strong>{teamName}</strong> on ActionLoop.
            </Text>
            <Text className="text-base text-slate-700">
              Join the team to collaborate on meetings, track action items, and stay on top of team progress.
            </Text>

            <Section className="my-6 text-center">
              <Button
                href={inviteUrl}
                className="rounded-xl bg-blue-600 px-6 py-3 text-center text-white font-semibold hover:bg-blue-700"
              >
                Accept Invitation
              </Button>
            </Section>

            <Text className="text-sm text-slate-600">
              This invite expires on <strong>{formattedDate}</strong>.
            </Text>

            <Text className="text-sm text-slate-600">
              If you didn't expect this invitation or have questions, you can safely ignore this email.
            </Text>
          </Section>

          <Section className="mt-8 border-t border-slate-200 pt-6">
            <Text className="text-xs text-slate-500">
              © 2026 ActionLoop. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default TeamInviteEmail;
