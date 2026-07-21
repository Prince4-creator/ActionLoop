import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json(
        { error: 'Account deletion is not configured on this server (missing SUPABASE_SERVICE_ROLE_KEY).' },
        { status: 500 }
      );
    }

    // teams.owner_id references auth.users ON DELETE CASCADE, so deleting an
    // owner silently wipes the whole team (and its meetings) out from under
    // anyone else in it. Block deletion in that case instead of doing that
    // by surprise.
    const { data: ownedTeams, error: ownedTeamsError } = await adminClient
      .from('teams')
      .select('id, name')
      .eq('owner_id', user.id);

    if (ownedTeamsError) {
      return NextResponse.json({ error: ownedTeamsError.message }, { status: 500 });
    }

    for (const team of ownedTeams ?? []) {
      const { count, error: countError } = await adminClient
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', team.id)
        .neq('user_id', user.id);

      if (countError) {
        return NextResponse.json({ error: countError.message }, { status: 500 });
      }

      if ((count ?? 0) > 0) {
        return NextResponse.json(
          {
            error: `You own the team "${team.name}" which has other members. Transfer ownership or remove its members in Team Settings before deleting your account.`,
          },
          { status: 409 }
        );
      }
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to delete account' },
      { status: 500 }
    );
  }
}