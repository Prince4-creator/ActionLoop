import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { getTeamIdForUser, getTeamMembersWithEmails } from '@/lib/teams';
import { isAdminUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/admin';
import { getTeamAccountability, type AccountabilityRow } from '@/lib/accountability';
import TeamClient from './team-client';

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const teamId = await getTeamIdForUser(supabase, user.id, user.email);

  if (!teamId) {
    return (
      <AppShell user={user} currentPath="/team" title="Team" description="Your workspace team">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/60 bg-white/80 p-8 shadow-sm backdrop-blur">
          <p className="text-sm text-muted-foreground">We could not resolve a team for your account yet.</p>
        </div>
      </AppShell>
    );
  }

  const isAdmin = isAdminUser(user);

  // Use the admin client when available so this read isn't at the mercy of
  // the "teams_select_members" RLS policy — without it, a null `team` here
  // silently breaks the invite button downstream (team?.id becomes
  // undefined, and /api/team/invite rejects the request).
  const adminClient = createAdminClient();
  const teamsClient = adminClient ?? supabase;
  const { data: team, error: teamError } = await teamsClient
    .from('teams')
    .select('id, name, owner_id, created_at')
    .eq('id', teamId)
    .maybeSingle();

  if (teamError) {
    console.error('[team/page] failed to load team row', teamError);
  }

  const members = await getTeamMembersWithEmails(supabase, teamId);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: actionItemsData } = await supabase
    .from('action_items')
    .select('id, status, assignee_email, created_at, meeting_id')
    .gte('created_at', monthStart.toISOString());

  const meetingIds = Array.from(new Set((actionItemsData ?? []).map((item) => item.meeting_id).filter(Boolean)));
  const { data: meetingsData } = meetingIds.length
    ? await supabase.from('meetings').select('id, team_id').in('id', meetingIds)
    : { data: [] as Array<{ id: string; team_id: string | null }> };

  const teamMeetingIds = new Set((meetingsData ?? []).filter((meeting) => meeting.team_id === teamId).map((meeting) => meeting.id));
  const monthlyItems = (actionItemsData ?? []).filter((item) => item.meeting_id && teamMeetingIds.has(item.meeting_id));

  const memberScores = members.map((member) => {
    const total = monthlyItems.filter((item) => item.assignee_email?.toLowerCase() === member.email?.toLowerCase()).length;
    const done = monthlyItems.filter(
      (item) => item.assignee_email?.toLowerCase() === member.email?.toLowerCase() && item.status === 'done'
    ).length;
    return {
      ...member,
      total,
      done,
      score: total ? Math.round((done / total) * 100) : 0,
    };
  });

  const leaderboard = memberScores.sort((a, b) => b.score - a.score || a.email?.localeCompare(b.email ?? '') || 0);

  // Admin-only: lifetime on-time-completion accountability, separate from
  // the monthly leaderboard score above (which only counts the current month
  // and doesn't factor in whether items were completed on time vs. late).
  let accountability: AccountabilityRow[] = [];
  if (isAdmin) {
    try {
      accountability = await getTeamAccountability(supabase, teamId);
    } catch (error) {
      console.error('[team/page] failed to load accountability', error);
    }
  }

  return (
    <AppShell user={user} currentPath="/team" title="Team" description={team?.name || 'Your team workspace'}>
      <TeamClient
        team={team}
        members={leaderboard}
        currentUserId={user.id}
        currentUserEmail={user.email}
        isAdmin={isAdmin}
        accountability={accountability}
      />
    </AppShell>
  );
}