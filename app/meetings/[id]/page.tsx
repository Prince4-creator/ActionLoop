import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { isAdminUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/admin';
import MeetingDetailClient from './meeting-detail-client';
import { AppShell } from '@/components/app-shell';
import { getTeamIdsForUser } from '@/lib/teams';

type MeetingRecord = {
  id: string;
  user_id: string;
  title?: string | null;
  summary?: string | null;
  notes?: string | null;
  desired_outcome?: string | null;
  decision?: string | null;
  outcome_score?: number;
  attendee_count?: number | null;
  avg_hourly_rate?: number | null;
};

type ActionItemRecord = {
  id: string;
  description: string;
  assignee_email: string;
  due_date: string | null;
  status: string;
};

type SharedMemberRecord = {
  email: string;
  created_at: string;
};

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { id: meetingId } = await params;
  const isAdmin = isAdminUser(user);
  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;
  const teamIds = await getTeamIdsForUser(client, user.id);

  let meetingQuery = client
    .from('meetings')
    .select('*')
    .eq('id', meetingId);

  if (teamIds.length) {
    meetingQuery = meetingQuery.in('team_id', teamIds);
  }

  const meetingResult = await meetingQuery.maybeSingle<MeetingRecord>();
  let meeting = meetingResult.data;
  let meetingError = meetingResult.error;
  const meetingClient = client;

  // (debug logs removed)

  if (!meeting && user.id) {
    // Try an explicit select. If the DB/schema is missing columns, detect them
    // from the error message and retry without those columns so the page still loads.
    const fallback = await client
      .from('meetings')
      .select('id, user_id, title, summary, notes, desired_outcome, decision, outcome_score, attendee_count, avg_hourly_rate')
      .eq('id', meetingId)
      .maybeSingle<MeetingRecord>();

    meeting = fallback.data;
    meetingError = fallback.error;

    if (meetingError) {
      const msg = String(meetingError.message ?? '').toLowerCase();
      if (/does not exist/.test(msg)) {
        const missingCols: string[] = [];
        const colRegex = /column\s+(?:\w+\.)?(\w+)\s+does not exist/gi;
        let m: RegExpExecArray | null;
        while ((m = colRegex.exec(msg)) !== null) {
          if (m[1]) missingCols.push(m[1]);
        }

        const allCols = ['id', 'user_id', 'title', 'summary', 'notes', 'desired_outcome', 'decision', 'outcome_score', 'attendee_count', 'avg_hourly_rate'];
        const colsToSelect = allCols.filter(c => !missingCols.includes(c)).join(', ');

        // If all requested columns are missing, fall back to a minimal select.
        const safeSelect = colsToSelect || 'id, user_id, title, summary';

        let retryQuery = client
          .from('meetings')
          .select(safeSelect)
          .eq('id', meetingId);

        if (teamIds.length) {
          retryQuery = retryQuery.in('team_id', teamIds);
        }

        const retry = await retryQuery.maybeSingle<Partial<MeetingRecord>>();

        meeting = retry.data && retry.data.id && retry.data.user_id ? (retry.data as MeetingRecord) : null;
        meetingError = retry.error ?? null;
      }
    }

    // (debug logs removed)
  }

  if (meetingError || !meeting) {
    return (
      <AppShell user={user} currentPath="/dashboard" title="Meeting" description="Meeting not accessible">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/60 bg-white/70 p-8 shadow-sm backdrop-blur">
          <p className="text-muted-foreground">
            The meeting could not be loaded. That usually means Row Level Security blocked the read or the row
            does not exist for this session.
          </p>
        </div>
      </AppShell>
    );
  }

  const { data: actionItemsData } = await meetingClient
    .from('action_items')
    .select('*')
    .eq('meeting_id', meeting.id)
    .order('created_at')
    .returns<ActionItemRecord[]>();
  const actionItems = actionItemsData ?? [];

  const canManageSharing = isAdmin || meeting.user_id === user.id;
  const { data: sharedMembersData } = canManageSharing
    ? await meetingClient
        .from('meeting_members')
        .select('email, created_at')
        .eq('meeting_id', meeting.id)
        .order('created_at')
        .returns<SharedMemberRecord[]>()
    : { data: [] as SharedMemberRecord[] };
  const sharedMembers = sharedMembersData ?? [];

  return (
    <AppShell user={user} currentPath="/meetings" title="Meeting" description={meeting.title || 'Meeting details'}>
      <MeetingDetailClient
        meeting={meeting}
        initialActionItems={actionItems}
        initialSharedMembers={sharedMembers}
        canManageSharing={canManageSharing}
        isAdmin={isAdmin}
        currentUserId={user.id}
      />
    </AppShell>
  );
}