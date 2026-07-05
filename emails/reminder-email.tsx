import { Body } from '@react-email/body';
import { Button } from '@react-email/button';
import { Container } from '@react-email/container';
import { Head } from '@react-email/head';
import { Html } from '@react-email/html';
import { Preview } from '@react-email/preview';
import { Section } from '@react-email/section';
import { Text } from '@react-email/text';

interface ReminderEmailProps {
  recipientName?: string;
  meetingTitle: string;
  taskDescription: string;
  dueDate: string;
  meetingUrl: string;
  isEscalation?: boolean;
}

export function ReminderEmail({
  recipientName,
  meetingTitle,
  taskDescription,
  dueDate,
  meetingUrl,
  isEscalation = false,
}: ReminderEmailProps) {
  const subject = isEscalation
    ? `Escalation: task still overdue in ${meetingTitle}`
    : `Reminder: ${meetingTitle} action item due soon`;

  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body className="bg-slate-50 text-slate-900">
        <Container className="mx-auto my-10 w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <Section className="mb-6">
            <Text className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">ActionLoop reminder</Text>
          </Section>
          <Section className="mb-6">
            <Text className="text-3xl font-semibold text-slate-900">{isEscalation ? 'Escalation alert' : `Hello ${recipientName ?? 'there'}`}</Text>
          </Section>
          <Section className="space-y-4">
            <Text className="text-base text-slate-700">{isEscalation
              ? `The following task is still not completed and has now received its second reminder.`
              : `Here is a friendly reminder for a task in ${meetingTitle}.`}
            </Text>
            <div className="rounded-3xl bg-slate-100 p-5">
              <Text className="text-sm font-semibold text-slate-900">Task</Text>
              <Text className="mt-2 text-base text-slate-700">{taskDescription}</Text>
              <Text className="mt-4 text-sm text-slate-500">Due date: <span className="font-semibold text-slate-700">{dueDate}</span></Text>
            </div>
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
              View Task
            </Button>
          </Section>
          <Section className="mt-8 border-t border-slate-200 pt-6">
            <Text className="text-sm text-slate-500">Need help or want to update the task? Visit the meeting and mark it complete when you’re ready.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
