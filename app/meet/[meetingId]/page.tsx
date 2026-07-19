import { createAdminClient } from '@/lib/admin';
import MeetClient from './meet-client';

export default async function MeetPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = await params;
  const adminClient = createAdminClient();

  let meetingTitle: string | null = null;
  if (adminClient) {
    const { data } = await adminClient.from('meetings').select('title').eq('id', meetingId).maybeSingle();
    meetingTitle = data?.title ?? null;
  }

  return <MeetClient meetingId={meetingId} meetingTitle={meetingTitle} />;
}