import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { isAdminUser } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const targetId = String(body?.id ?? '').trim();
    if (!targetId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (targetId === user.id) {
      return NextResponse.json(
        { error: 'Use your account settings to delete your own account.' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
    }

    // Grab the email up front for the audit trail, since it won't be
    // queryable once the auth user (and cascaded profile row) is gone.
    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('email')
      .eq('id', targetId)
      .maybeSingle();

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetId);
    if (deleteError) {
      // If the auth user is already gone, the profile row is orphaned —
      // finish the cleanup by deleting the leftover profile row instead of
      // treating this as a hard failure.
      const isNotFound = /user not found/i.test(deleteError.message);
      if (isNotFound) {
        const { error: profileDeleteError } = await adminClient
          .from('profiles')
          .delete()
          .eq('id', targetId);
        if (profileDeleteError) {
          return NextResponse.json({ error: profileDeleteError.message }, { status: 500 });
        }
        // fall through to audit log + success below
      } else {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    }

    await logAdminAction(adminClient, {
      actorId: user.id,
      actorEmail: user.email,
      action: 'user_deleted',
      targetType: 'profiles',
      targetId,
      details: { email: targetProfile?.email ?? null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? 'Failed to delete user' }, { status: 500 });
  }
}