import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { isAdminUser } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';

export async function POST(req: Request) {
  try {
    const contentType = String(req.headers.get('content-type') ?? '').toLowerCase();
    let body: any = {};

    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => ({}));
    } else {
      const form = await req.formData().catch(() => null);
      if (form) body = Object.fromEntries(form.entries());
    }

    const id = String(body.id ?? '').trim();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
    }

    const { error } = await adminClient.from('meeting_requests').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAdminAction(adminClient, {
      actorId: user.id,
      actorEmail: user.email,
      action: 'meeting_request_deleted',
      targetType: 'meeting_requests',
      targetId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? 'Failed' }, { status: 500 });
  }
}