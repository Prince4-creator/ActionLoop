import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from './dashboard-client';
import { isAdminUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/admin';
import { getTeamIdsForUser, ensureDefaultTeamForUser } from '@/lib/teams';
import { AppShell } from '@/components/app-shell';

type MeetingSummary = {
  id: string;
  user_id: string;
  title: string | null;
  summary: string | null;
  created_at?: string;
  outcome_score: number;
};

type ActionItemSummary = {
  id: string;
  description: string;
  assignee_email: string;
  due_date: string | null;
  status: string;
  meeting_id: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const isAdmin = isAdminUser(user);
  const adminClient = createAdminClient();
  const meetingsClient = isAdmin && adminClient ? adminClient : supabase;

  // A user can belong to more than one team (e.g. their own default team
  // plus a team they were invited into). We need meetings from ALL of them,
  // not just the first one, or admin-created meetings silently disappear
  // for members whose "first" team differs from the one the meeting lives in.
  let teamIds = await getTeamIdsForUser(supabase, user.id);
  if (!teamIds.length) {
    const defaultTeamId = await ensureDefaultTeamForUser(supabase, user.id, user.email);
    teamIds = defaultTeamId ? [defaultTeamId] : [];
  }

  const { data: meetings } = teamIds.length
    ? await meetingsClient
        .from('meetings')
        .select('id, user_id, title, summary, created_at, outcome_score')
        .in('team_id', teamIds)
        .order('created_at', { ascending: false })
    : { data: [] as Array<{ id: string; user_id: string; title: string | null; summary: string | null; created_at?: string; outcome_score: number }> };

  const { data: actionItemsData } = await meetingsClient
    .from('action_items')
    .select('id, description, assignee_email, due_date, status, meeting_id')
    .in('meeting_id', (meetings ?? []).map((meeting) => meeting.id))
    .order('due_date', { ascending: true });

  const meetingList = (meetings ?? []) as MeetingSummary[];
  const actionItems = (actionItemsData ?? []) as ActionItemSummary[];
  const yourMeetingsCount = meetingList.filter((meeting) => meeting.user_id === user.id).length;
  const sharedMeetingsCount = Math.max(0, meetingList.length - yourMeetingsCount);
  const overdueCount = actionItems.filter((item) => item.status === 'overdue').length;
  const pendingActionItems = actionItems.filter((item) => item.status !== 'done').slice(0, 5);
  const completedCount = actionItems.filter((item) => item.status === 'done').length;
  const completionPercent = actionItems.length ? Math.round((completedCount / actionItems.length) * 100) : 0;
  const averageOutcomeScore = meetingList.length
    ? Math.round(meetingList.reduce((sum, meeting) => sum + (meeting.outcome_score ?? 0), 0) / meetingList.length)
    : 0;

  return (
    <AppShell user={user} currentPath="/dashboard" title="Dashboard" description="Monitor your meetings and workspace progress">
      <DashboardClient
        user={user}
        isAdmin={isAdmin}
        meetings={meetingList}
        counts={{ total: meetingList.length, your: yourMeetingsCount, shared: sharedMeetingsCount }}
        actionItems={pendingActionItems}
        overdueCount={overdueCount}
        completionPercent={completionPercent}
        averageOutcomeScore={averageOutcomeScore}
      />
    </AppShell>
  );
}