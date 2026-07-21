'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { randomBytes } from 'crypto';

export async function createInviteLink(teamId: string, options?: { maxUses?: number | null; expiresInDays?: number | null }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: membership } = await client
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role !== 'owner') {
    throw new Error('Only team owners can create invite links');
  }

  const token = randomBytes(24).toString('hex');
  const expiresAt = options?.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data: link, error } = await client
    .from('team_invite_links')
    .insert({
      team_id: teamId,
      token,
      created_by: user.id,
      max_uses: options?.maxUses ?? null,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create invite link: ${error.message}`);
  return link;
}

export async function getInviteLinks(teamId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: membership } = await client
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) throw new Error('Not a member of this team');

  const { data: links, error } = await client
    .from('team_invite_links')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch invite links: ${error.message}`);
  return links || [];
}

export async function revokeInviteLink(linkId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: link } = await client
    .from('team_invite_links')
    .select('team_id')
    .eq('id', linkId)
    .maybeSingle();

  if (!link) throw new Error('Invite link not found');

  const { data: membership } = await client
    .from('team_members')
    .select('role')
    .eq('team_id', link.team_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role !== 'owner') {
    throw new Error('Only team owners can revoke invite links');
  }

  const { error } = await client.from('team_invite_links').update({ revoked: true }).eq('id', linkId);
  if (error) throw new Error(`Failed to revoke link: ${error.message}`);

  return { success: true };
}

export async function getInviteLinkDetails(token: string) {
  const adminClient = createAdminClient();
  const supabase = await createClient();
  const client = adminClient ?? supabase;

  const { data: link, error } = await client
    .from('team_invite_links')
    .select('id, team_id, max_uses, use_count, revoked, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !link) throw new Error('Invalid invite link');
  if (link.revoked) throw new Error('This invite link has been revoked');
  if (link.expires_at && new Date(link.expires_at) < new Date()) throw new Error('This invite link has expired');
  if (link.max_uses !== null && link.use_count >= link.max_uses) throw new Error('This invite link has reached its usage limit');

  const { data: team } = await client.from('teams').select('name').eq('id', link.team_id).maybeSingle();

  return { teamName: team?.name || 'a team', teamId: link.team_id };
}

export async function joinViaInviteLink(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: link, error: linkError } = await client
    .from('team_invite_links')
    .select('id, team_id, max_uses, use_count, revoked, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (linkError || !link) throw new Error('Invalid invite link');
  if (link.revoked) throw new Error('This invite link has been revoked');
  if (link.expires_at && new Date(link.expires_at) < new Date()) throw new Error('This invite link has expired');
  if (link.max_uses !== null && link.use_count >= link.max_uses) throw new Error('This invite link has reached its usage limit');

  const { data: existingMembership } = await client
    .from('team_members')
    .select('team_id')
    .eq('team_id', link.team_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingMembership) {
    return { success: true, teamId: link.team_id, alreadyMember: true };
  }

  const { error: memberError } = await client.from('team_members').insert({
    team_id: link.team_id,
    user_id: user.id,
    role: 'member',
  });

  if (memberError && !memberError.message?.includes('duplicate')) {
    throw new Error(`Failed to join team: ${memberError.message}`);
  }

  await client.from('team_invite_links').update({ use_count: link.use_count + 1 }).eq('id', link.id);

  return { success: true, teamId: link.team_id, alreadyMember: false };
}