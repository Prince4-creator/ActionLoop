import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { isAdminUser } from '@/lib/auth';

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

    const { data: requestRow, error: fetchErr } = await adminClient.from('meeting_requests').select('*').eq('id', id).maybeSingle();
    if (fetchErr || !requestRow) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    if (!requestRow.user_id) {
      return NextResponse.json({ error: 'Request is missing user_id' }, { status: 400 });
    }

    const { data: meeting, error: insertErr } = await adminClient.from('meetings').insert({
      user_id: requestRow.user_id,
      title: requestRow.title ?? null,
      summary: requestRow.message ?? null,
      created_at: new Date().toISOString(),
    }).select().single();

    if (insertErr || !meeting) {
      return NextResponse.json({ error: insertErr?.message ?? 'Unable to create meeting' }, { status: 500 });
    }

    const { error: deleteErr } = await adminClient.from('meeting_requests').delete().eq('id', id);
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message ?? 'Meeting created but request deletion failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, meetingId: meeting.id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? 'Failed' }, { status: 500 });
  }
}
