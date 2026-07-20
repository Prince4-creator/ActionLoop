import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { redirect } from 'next/navigation';
import { getTeamMembersWithEmails, getTeamIdForUser } from '@/lib/teams';
import TeamSettingsClient from '../settings-client';
import { AppShell } from '@/components/app-shell';

type TeamMember = {
  user_id: string;
  email: string | null;
  role: string;
  joined_at: string | null;
};

export default async function TeamSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const teamId = await getTeamIdForUser(supabase, user.id, user.email);

  if (!teamId) {
    redirect('/dashboard');
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  // Get team info
  const { data: team } = await client
    .from('teams')
    .select('id, name')
    .eq('id', teamId)
    .maybeSingle();

  if (!team) {
    redirect('/dashboard');
  }

  // Get current user's role
  const { data: userMembership } = await client
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .maybeSingle();

  // Get all team members
  const teamMembers = await getTeamMembersWithEmails(supabase, teamId);

  return (
    <AppShell user={user} currentPath="/team/settings" title="Team Settings" description="Manage your team">
      <TeamSettingsClient
        teamId={teamId}
        teamName={team.name || 'Team'}
        teamMembers={teamMembers}
        userRole={userMembership?.role || 'member'}
        currentUserId={user.id}
      />
    </AppShell>
  );
}


