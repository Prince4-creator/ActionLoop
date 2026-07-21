import { Body } from '@react-email/body';
import { Button } from '@react-email/button';
import { Container } from '@react-email/container';
import { Head } from '@react-email/head';
import { Html } from '@react-email/html';
import { Preview } from '@react-email/preview';
import { Section } from '@react-email/section';
import { Text } from '@react-email/text';

interface DigestEmailProps {
  meetingTitle: string;
  summary: string | null;
  decision: string | null;
  notes: string | null;
  desiredOutcome: string | null;
  actionItemCount: number;
  meetingUrl: string;
}

export function DigestEmail({
  meetingTitle,
  summary,
  decision,
  notes,
  desiredOutcome,
  actionItemCount,
  meetingUrl,
}: DigestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Digest: ${meetingTitle}`}</Preview>
      <Body className="bg-slate-50 text-slate-900">
        <Container className="mx-auto my-10 w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <Section className="mb-6">
            <Text className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">ActionLoop digest</Text>
          </Section>
          <Section className="mb-6">
            <Text className="text-3xl font-semibold text-slate-900">{meetingTitle}</Text>
            <Text className="mt-1 text-sm text-slate-500">You weren't in this meeting — here's what happened.</Text>
          </Section>

          <Section className="space-y-4">
            <div className="rounded-3xl bg-slate-100 p-5">
              <Text className="text-sm font-semibold text-slate-900">Summary</Text>
              <Text className="mt-2 text-base text-slate-700">{summary || 'No summary recorded.'}</Text>
            </div>

            {desiredOutcome ? (
              <div className="rounded-3xl bg-slate-100 p-5">
                <Text className="text-sm font-semibold text-slate-900">Desired outcome</Text>
                <Text className="mt-2 text-base text-slate-700">{desiredOutcome}</Text>
              </div>
            ) : null}

            {decision ? (
              <div className="rounded-3xl bg-slate-100 p-5">
                <Text className="text-sm font-semibold text-slate-900">Decision</Text>
                <Text className="mt-2 text-base text-slate-700">{decision}</Text>
              </div>
            ) : null}

            {notes ? (
              <div className="rounded-3xl bg-slate-100 p-5">
                <Text className="text-sm font-semibold text-slate-900">Notes</Text>
                <Text className="mt-2 text-base text-slate-700">{notes}</Text>
              </div>
            ) : null}

            <Text className="text-sm text-slate-600">
              {actionItemCount} action item{actionItemCount === 1 ? '' : 's'} came out of this meeting.
            </Text>
          </Section>

          <Section className="mt-6">
            <Button
              style={{
                padding: '12px 24px',
                borderRadius: '9999px',
                backgroundColor: '#0f172a',
                color: '#fff',
                textDecoration: 'none',
              }}
              href={meetingUrl}
            >
              View full meeting
            </Button>
          </Section>

          <Section className="mt-8 border-t border-slate-200 pt-6">
            <Text className="text-sm text-slate-500">This is a one-time summary email — no account or login needed to read it.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default DigestEmail;