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

  const { data: membership, error: membershipError } = await client
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError) {
    console.error('[inviteTeamMember] membership lookup failed', membershipError);
    throw new Error(`Membership check failed: ${membershipError.message}`);
  }

  if (!membership || membership.role !== 'owner') {
    throw new Error('Only team owners can invite members');
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Enter a valid email address');
  }

  // Check if this specific email already belongs to a team member (not just "team has members")
  if (adminClient) {
    try {
      const { data: authUserList } = await adminClient.auth.admin.listUsers();
      const matchedUser = authUserList?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);
      if (matchedUser) {
        const { data: existingMembership } = await client
          .from('team_members')
          .select('id')
          .eq('team_id', teamId)
          .eq('user_id', matchedUser.id)
          .maybeSingle();
        if (existingMembership) {
          throw new Error('This person is already a member of the team');
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('already a member')) {
        throw err;
      }
      console.error('[inviteTeamMember] existing-member lookup failed (non-fatal)', err);
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

  // If a non-pending invite (declined/revoked/accepted-then-removed) already exists
  // for this team+email, UPDATE it instead of INSERT to avoid the unique constraint.
  let invite: { id: string } | null = null;
  let inviteError: { message: string; code?: string } | null = null;

  if (existingInvite) {
    const updateResult = await client
      .from('team_invites')
      .update({
        token,
        status: 'pending',
        invited_by: user.id,
        expires_at: expiresAt,
        accepted_at: null,
      })
      .eq('id', existingInvite.id)
      .select('id')
      .single();
    invite = updateResult.data;
    inviteError = updateResult.error;
  } else {
    const insertResult = await client
      .from('team_invites')
      .insert({
        team_id: teamId,
        email: normalizedEmail,
        invited_by: user.id,
        token,
        expires_at: expiresAt,
      })
      .select('id')
      .single();
    invite = insertResult.data;
    inviteError = insertResult.error;
  }

  if (inviteError) {
    console.error('[inviteTeamMember] insert/update failed', inviteError);

    // Only report "table missing" for the specific Postgres/PostgREST codes that mean that.
    // 42P01 = undefined_table, PGRST205 = PostgREST schema-cache miss.
    const code = (inviteError as { code?: string }).code;
    if (code === '42P01' || code === 'PGRST205') {
      throw new Error(
        'Team invite table not found. Please run the setup SQL in your Supabase Dashboard SQL Editor.'
      );
    }

    if (code === '23505') {
      throw new Error('An invite for this email already exists for this team.');
    }

    if (inviteError.message?.toLowerCase().includes('row-level security')) {
      throw new Error('You do not have permission to invite members to this team.');
    }

    throw new Error(`Failed to create invite: ${inviteError.message}`);
  }

  if (!invite) {
    throw new Error('Failed to create invite');
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
    console.error('[inviteTeamMember] email send failed (non-fatal)', emailError);
    // Invite row exists even if email delivery failed — don't block the caller.
  }

  return { success: true, inviteId: invite.id };
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