import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { isAdminUser } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';

// Supabase's ban_duration accepts strings like "24h", "168h" (7d), "720h" (30d).
// There's no literal "permanent" — the convention is a very long duration.
const DURATION_TO_BAN: Record<string, string> = {
  '1h': '1h',
  '24h': '24h',
  '7d': '168h',
  '30d': '720h',
  permanent: '876000h', // ~100 years
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const targetId = String(body?.id ?? '').trim();
    const action = String(body?.action ?? '').trim();

    if (!targetId) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    if (action !== 'suspend' && action !== 'unsuspend') {
      return NextResponse.json({ error: 'action must be "suspend" or "unsuspend"' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (targetId === user.id) {
      return NextResponse.json({ error: 'You cannot suspend your own account.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
    }

    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('email')
      .eq('id', targetId)
      .maybeSingle();

    if (action === 'suspend') {
      const durationKey = String(body?.duration ?? '24h').trim();
      const banDuration = DURATION_TO_BAN[durationKey];
      if (!banDuration) {
        return NextResponse.json({ error: `Unknown suspend duration "${durationKey}"` }, { status: 400 });
      }

      const { data: updated, error: updateError } = await adminClient.auth.admin.updateUserById(targetId, {
        ban_duration: banDuration,
      });

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Setting ban_duration alone does NOT invalidate an already-issued
      // access token — it only blocks future sign-ins / refreshes. Revoke
      // all of the user's existing sessions so the suspension takes effect
      // immediately instead of waiting up to an hour for their token to expire.
      try {
        await adminClient.auth.admin.signOut(targetId, 'global');
      } catch (signOutError) {
        // Non-fatal: the ban itself is already in place; log and continue.
        console.error('[admin/users/suspend] failed to revoke existing sessions', signOutError);
      }

      await logAdminAction(adminClient, {
        actorId: user.id,
        actorEmail: user.email,
        action: 'user_suspended',
        targetType: 'profiles',
        targetId,
        details: { email: targetProfile?.email ?? null, duration: durationKey },
      });

      return NextResponse.json({
        success: true,
        bannedUntil: updated?.user?.banned_until ?? null,
      });
    }

    // action === 'unsuspend'
    const { error: updateError } = await adminClient.auth.admin.updateUserById(targetId, {
      ban_duration: 'none',
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await logAdminAction(adminClient, {
      actorId: user.id,
      actorEmail: user.email,
      action: 'user_unsuspended',
      targetType: 'profiles',
      targetId,
      details: { email: targetProfile?.email ?? null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? 'Failed to update suspension' }, { status: 500 });
  }
}