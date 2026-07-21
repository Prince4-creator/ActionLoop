import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { isAdminUser } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';

export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      try {
        const form = await req.formData();
        body = Object.fromEntries(form.entries());
      } catch {
        body = {};
      }
    }

    const singleId = String(body.id ?? '').trim();
    const idsRaw = Array.isArray(body.ids) ? body.ids : [];
    const ids = (idsRaw.length ? idsRaw : singleId ? [singleId] : [])
      .map((v: unknown) => String(v).trim())
      .filter(Boolean);

    // `profiles.role` is NOT NULL in the database, so any non-'admin' value
    // (including '', undefined, or garbage input) must resolve to 'member'
    // rather than being passed through as null.
    const requestedRole = typeof body.role === 'string' ? body.role.trim() : '';
    const role: 'admin' | 'member' = requestedRole === 'admin' ? 'admin' : 'member';

    if (!ids.length) return NextResponse.json({ error: 'id or ids required' }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const adminClient = createAdminClient();
    const client = adminClient ?? supabase;

    const { error } = await client
      .from('profiles')
      .update({ role })
      .in('id', ids);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAdminAction(client, {
      actorId: user.id,
      actorEmail: user.email,
      action: role === 'admin' ? 'grant_admin_role' : 'revoke_admin_role',
      targetType: 'profiles',
      targetId: ids.length === 1 ? ids[0] : `${ids.length} users`,
      details: { ids, role },
    });

    return NextResponse.json({ success: true, updated: ids.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? 'Failed' }, { status: 500 });
  }
}