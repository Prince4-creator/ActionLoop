'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { isAdminUser } from '@/lib/auth';
import { getTeamIdForUser } from '@/lib/teams';
import { sendTeamInviteEmail } from '@/lib/email-invites';
import { randomBytes } from 'crypto';

export async function inviteTeamMember(teamId: string, email: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  // Verify user is a team owner
  const { data: membership, error: membershipError } = await client
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError || !membership || membership.role !== 'owner') {
    throw new Error('Only team owners can invite members');
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();

    const { data: existingMember } = await client
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .maybeSingle();

    if (existingMember) {
      const { data: authUser } = await (adminClient?.auth.admin.listUsers() ?? { data: { users: [] } });
      const userExists = authUser?.users?.some((u) => u.email?.toLowerCase() === normalizedEmail);
      if (userExists) {
        throw new Error('User is already a member of this team');
      }
    }

    const { data: existingInvite } = await client
      .from('team_invites')
      .select('id, status')
      .eq('team_id', teamId)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingInvite && existingInvite.status === 'pending') {
      throw new Error('An invite for this email is already pending');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error: inviteError } = await client
      .from('team_invites')
      .insert({
        team_id: teamId,
        email: normalizedEmail,
        invited_by: user.id,
        token,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (inviteError) {
      if (inviteError.message?.includes('team_invites') || inviteError.message?.includes('schema cache')) {
        throw new Error(
          'Team invite table not found. Please run this SQL in your Supabase Dashboard SQL Editor:\n\n' +
          'CREATE TABLE public.team_invites (id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade, email text not null, invited_by uuid not null references auth.users(id) on delete set null, token text not null unique, status text not null default \'pending\' check (status in (\'pending\', \'accepted\', \'declined\', \'revoked\')), created_at timestamptz not null default now(), accepted_at timestamptz null, expires_at timestamptz not null default (now() + interval \'7 days\'), unique(team_id, email)); alter table public.team_invites enable row level security; create index idx_team_invites_team_id on public.team_invites(team_id); create index idx_team_invites_email on public.team_invites(email); create index idx_team_invites_token on public.team_invites(token);'
        );
      }
      throw new Error(`Failed to create invite: ${inviteError.message}`);
    }

    try {
      const { data: team } = await client
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .maybeSingle();

      await sendTeamInviteEmail({
        to: normalizedEmail,
        teamName: team?.name || 'Your Team',
        invitedByEmail: user.email || 'admin',
        inviteToken: token,
        expiresAt: new Date(expiresAt),
      });
    } catch (emailError) {
      console.error('Failed to send invite email:', emailError);
    }

    return { success: true, inviteId: invite.id };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to create invite');
  }
}

export async function acceptTeamInvite(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    throw new Error('Not authenticated');
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: invite, error: inviteError } = await client
    .from('team_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (inviteError || !invite) {
    throw new Error('Invalid or expired invite');
  }

  if (invite.status !== 'pending') {
    throw new Error(`Invite has already been ${invite.status}`);
  }

  if (new Date(invite.expires_at) < new Date()) {
    throw new Error('Invite has expired');
  }

  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error('This invite is for a different email address');
  }

  const { error: memberError } = await client
    .from('team_members')
    .insert({
      team_id: invite.team_id,
      user_id: user.id,
      role: 'member',
    });

  if (memberError && !memberError.message?.includes('duplicate')) {
    throw new Error(`Failed to add team member: ${memberError.message}`);
  }

  const { error: updateError } = await client
    .from('team_invites')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id);

  if (updateError) {
    throw new Error(`Failed to accept invite: ${updateError.message}`);
  }

  return { success: true, teamId: invite.team_id };
}

export async function getTeamInvites(teamId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: membership } = await client
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    throw new Error('Not a member of this team');
  }

  const { data: invites, error } = await client
    .from('team_invites')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch invites: ${error.message}`);
  }

  return invites || [];
}

export async function revokeTeamInvite(inviteId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: invite } = await client
    .from('team_invites')
    .select('team_id')
    .eq('id', inviteId)
    .maybeSingle();

  if (!invite) {
    throw new Error('Invite not found');
  }

  const { data: membership } = await client
    .from('team_members')
    .select('role')
    .eq('team_id', invite.team_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role !== 'owner') {
    throw new Error('Only team owners can revoke invites');
  }

  const { error } = await client
    .from('team_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId);

  if (error) {
    throw new Error(`Failed to revoke invite: ${error.message}`);
  }

  return { success: true };
}

export async function getInviteDetails(token: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: invite, error } = await client
    .from('team_invites')
    .select('id, email, status, expires_at, team_id')
    .eq('token', token)
    .maybeSingle();

  if (error || !invite) {
    throw new Error('Invalid invite');
  }

  if (invite.status !== 'pending') {
    throw new Error(`Invite has already been ${invite.status}`);
  }

  if (new Date(invite.expires_at) < new Date()) {
    throw new Error('Invite has expired');
  }

  const { data: team } = await client
    .from('teams')
    .select('name')
    .eq('id', invite.team_id)
    .maybeSingle();

  return {
    email: invite.email,
    teamName: team?.name || 'Your Team',
    teamId: invite.team_id,
  };
}

export async function removeTeamMember(teamId: string, memberUserId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: membership } = await client
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role !== 'owner') {
    throw new Error('Only team owners can remove members');
  }

  if (memberUserId === user.id) {
    throw new Error('Owners cannot remove themselves. Transfer ownership to another member first.');
  }

  const { error } = await client
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', memberUserId);

  if (error) {
    throw new Error(`Failed to remove member: ${error.message}`);
  }

  return { success: true };
}

export async function updateTeamMemberRole(teamId: string, memberUserId: string, role: 'owner' | 'member') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: membership } = await client
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role !== 'owner') {
    throw new Error('Only team owners can change member roles');
  }

  if (memberUserId === user.id && role !== 'owner') {
    throw new Error('You cannot demote yourself. Promote another member to owner first.');
  }

  const { error } = await client
    .from('team_members')
    .update({ role })
    .eq('team_id', teamId)
    .eq('user_id', memberUserId);

  if (error) {
    throw new Error(`Failed to update role: ${error.message}`);
  }

  return { success: true };
}