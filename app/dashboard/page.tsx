import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from './dashboard-client';
import { isAdminUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/admin';
import { getTeamIdsForUser, ensureDefaultTeamForUser, getTeamMembersWithEmails } from '@/lib/teams';
import { getDisplayName } from '@/lib/profile';
import type { TrendPoint } from '@/components/dashboard/follow-through-trend';
import type { LeaderboardEntry } from '@/components/dashboard/team-leaderboard-mini';
import { AppShell } from '@/components/app-shell';

type MeetingSummary = {
  id: string;
  user_id: string;
  title: string | null;
  summary: string | null;
  created_at?: string;
  outcome_score: number;
  attendee_count?: number | null;
  avg_hourly_rate?: number | null;
};

type ActionItemSummary = {
  id: string;
  description: string;
  assignee_email: string;
  due_date: string | null;
  status: string;
  meeting_id: string;
};

// Same estimate used on the meeting detail page: attendees × hourly rate ×
// 30 minutes. Missing fields fall back to 1 attendee / $75/hr so meetings
// created before the cost fields existed still contribute a reasonable number.
function estimateMeetingCost(meeting: Pick<MeetingSummary, 'attendee_count' | 'avg_hourly_rate'>) {
  const attendeeCount = meeting.attendee_count ?? 1;
  const avgHourlyRate = meeting.avg_hourly_rate ?? 75;
  return attendeeCount * avgHourlyRate * 0.5;
}

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
        .select('id, user_id, title, summary, created_at, outcome_score, attendee_count, avg_hourly_rate')
        .in('team_id', teamIds)
        .order('created_at', { ascending: false })
    : {
        data: [] as Array<{
          id: string;
          user_id: string;
          title: string | null;
          summary: string | null;
          created_at?: string;
          outcome_score: number;
          attendee_count?: number | null;
          avg_hourly_rate?: number | null;
        }>,
      };

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

  // Display name set on the Settings page (profiles.full_name), used here
  // instead of the email-derived fallback. Looked up by email rather than
  // id — profiles.id is not guaranteed to equal auth.users.id in this
  // project, so an id-based lookup can silently match zero rows under RLS.
  const displayName = await getDisplayName(supabase, user);

  const WEEKS = 6;
  const now = new Date();
  const trendPoints: TrendPoint[] = Array.from({ length: WEEKS }).map((_, i) => {
    const weekIndex = WEEKS - 1 - i; // oldest first
    const start = new Date(now);
    start.setDate(start.getDate() - (weekIndex + 1) * 7);
    const end = new Date(now);
    end.setDate(end.getDate() - weekIndex * 7);

    const weekMeetings = meetingList.filter((m) => {
      if (!m.created_at) return false;
      const created = new Date(m.created_at);
      return created >= start && created < end;
    });

    const avgScore = weekMeetings.length
      ? Math.round(weekMeetings.reduce((sum, m) => sum + (m.outcome_score ?? 0), 0) / weekMeetings.length)
      : 0;

    return {
      label: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: avgScore,
      count: weekMeetings.length,
    };
  });

  // ---- Meeting cost this month ----
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const meetingsThisMonth = meetingList.filter((m) => m.created_at && new Date(m.created_at) >= monthStart);
  const meetingsLastMonth = meetingList.filter(
    (m) => m.created_at && new Date(m.created_at) >= lastMonthStart && new Date(m.created_at) < monthStart
  );

  const totalCostThisMonth = Math.round(meetingsThisMonth.reduce((sum, m) => sum + estimateMeetingCost(m), 0));
  const totalCostLastMonth = Math.round(meetingsLastMonth.reduce((sum, m) => sum + estimateMeetingCost(m), 0));

  // ---- Top-3 leaderboard, generalized across every team the user belongs to ----
  let leaderboard: LeaderboardEntry[] = [];

  if (teamIds.length && meetingList.length) {
    const memberLists = await Promise.all(teamIds.map((teamId) => getTeamMembersWithEmails(meetingsClient, teamId)));
    const memberMap = new Map<string, { user_id: string; email: string | null }>();
    for (const list of memberLists) {
      for (const member of list) {
        if (!memberMap.has(member.user_id)) {
          memberMap.set(member.user_id, { user_id: member.user_id, email: member.email });
        }
      }
    }

    const leaderboardMonthStart = new Date();
    leaderboardMonthStart.setDate(1);
    leaderboardMonthStart.setHours(0, 0, 0, 0);

    const { data: monthlyActionItems } = await meetingsClient
      .from('action_items')
      .select('id, status, assignee_email, created_at')
      .in('meeting_id', meetingList.map((m) => m.id))
      .gte('created_at', leaderboardMonthStart.toISOString());

    const monthlyItems = monthlyActionItems ?? [];

    leaderboard = Array.from(memberMap.values())
      .map((member) => {
        const memberItems = monthlyItems.filter(
          (item) => item.assignee_email?.toLowerCase() === member.email?.toLowerCase()
        );
        const total = memberItems.length;
        const done = memberItems.filter((item) => item.status === 'done').length;
        return {
          user_id: member.user_id,
          email: member.email,
          total,
          done,
          score: total ? Math.round((done / total) * 100) : 0,
        };
      })
      .filter((entry) => entry.total > 0)
      .sort((a, b) => b.score - a.score || b.done - a.done || (a.email ?? '').localeCompare(b.email ?? ''))
      .slice(0, 3);
  }

  return (
    <AppShell user={user} currentPath="/dashboard" title="Dashboard" description="Monitor your meetings and workspace progress" displayName={displayName}>
      <DashboardClient
        user={user}
        isAdmin={isAdmin}
        displayName={displayName}
        meetings={meetingList}
        counts={{ total: meetingList.length, your: yourMeetingsCount, shared: sharedMeetingsCount }}
        actionItems={pendingActionItems}
        overdueCount={overdueCount}
        completionPercent={completionPercent}
        averageOutcomeScore={averageOutcomeScore}
        trendPoints={trendPoints}
        costSummary={{
          totalCostThisMonth,
          totalCostLastMonth,
          meetingCountThisMonth: meetingsThisMonth.length,
        }}
        leaderboard={leaderboard}
      />
    </AppShell>
  );
}