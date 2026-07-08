import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/admin';

export type TeamMembership = {
  team_id: string;
  role: string;
  joined_at: string | null;
};

function getErrorMessage(error: unknown) {
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const candidates = [record.message, record.details, record.hint, record.code];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
  }

  return '';
}

function isMissingTableError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return /does not exist|relation .* does not exist|not found|schema cache|pgrst205|42p01/i.test(message);
}

export async function getUserTeamMembership(
  supabase: SupabaseClient,
  userId: string
): Promise<TeamMembership | null> {
  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  console.log('[teams] membership lookup', { userId, usingAdmin: Boolean(adminClient) });

  try {
    const { data, error } = await client
      .from('team_members')
      .select('team_id, role, joined_at')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[teams] membership lookup error', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[teams] membership lookup threw', error);
    return null;
  }
}

export async function ensureDefaultTeamForUser(
  supabase: SupabaseClient,
  userId: string,
  email: string | null | undefined
) {
  const existing = await getUserTeamMembership(supabase, userId);
  if (existing?.team_id) {
    return existing.team_id;
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  console.log('[teams] ensure default team', { userId, usingAdmin: Boolean(adminClient), email });

  const teamName = email ? `${email.split('@')[0]}'s workspace` : 'Personal workspace';

  try {
    const { data: team, error: teamError } = await client
      .from('teams')
      .insert({ name: teamName, owner_id: userId })
      .select('id')
      .single();

    if (teamError || !team?.id) {
      if (isMissingTableError(teamError)) {
        return null;
      }

      throw teamError ?? new Error('Unable to create a default team');
    }

    const { error: memberError } = await client.from('team_members').insert({
      team_id: team.id,
      user_id: userId,
      role: 'owner',
    });

    if (memberError) {
      if (isMissingTableError(memberError)) {
        return null;
      }

      throw memberError;
    }

    return team.id;
  } catch {
    return null;
  }
}

export async function getTeamMembersWithEmails(
  supabase: SupabaseClient,
  teamId: string
) {
  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: memberships, error } = await client
    .from('team_members')
    .select('user_id, role, joined_at')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true });

  if (error || !memberships?.length) {
    return [] as Array<{ user_id: string; role: string; joined_at: string | null; email: string | null }>;
  }

  const userMap = new Map<string, string | null>();

  if (adminClient) {
    try {
      const { data: authUsers } = await adminClient.auth.admin.listUsers();
      for (const user of authUsers?.users ?? []) {
        userMap.set(user.id, user.email ?? null);
      }
    } catch {
      // ignore auth lookup failures and fall back to user ids
    }
  }

  return memberships.map((membership) => ({
    ...membership,
    email: userMap.get(membership.user_id) ?? null,
  }));
}

export async function getTeamIdForUser(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null
) {
  const membership = await getUserTeamMembership(supabase, userId);
  if (membership?.team_id) {
    return membership.team_id;
  }

  if (!email) {
    return null;
  }

  return ensureDefaultTeamForUser(supabase, userId, email);
}

export async function getTeamIdsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  try {
    const { data, error } = await client
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId);

    if (error) {
      console.error('[teams] getTeamIdsForUser error', error);
      return [];
    }

    return (data ?? []).map((row) => row.team_id).filter(Boolean);
  } catch (error) {
    console.error('[teams] getTeamIdsForUser threw', error);
    return [];
  }
}