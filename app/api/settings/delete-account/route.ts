import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({} as { confirmEmail?: string }));
    const confirmEmail = typeof body.confirmEmail === 'string' ? body.confirmEmail.trim().toLowerCase() : '';

    if (!confirmEmail || confirmEmail !== (user.email ?? '').toLowerCase()) {
      return NextResponse.json({ error: 'Type your email exactly to confirm deletion' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json(
        { error: 'Account deletion is not configured on this server (missing SUPABASE_SERVICE_ROLE_KEY).' },
        { status: 500 }
      );
    }

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
      console.error('[delete-account] deleteUser failed:', {
        name: deleteError.name,
        message: deleteError.message,
        status: (deleteError as any).status,
        cause: (deleteError as any).cause,
      });
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    await supabase.auth.signOut().catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[delete-account] unhandled error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to delete account' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: 'delete-account' });
}