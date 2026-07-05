import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/admin';
import { isAdminUser } from '@/lib/auth';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Try inserting into meeting_requests table if present
    const requestPayload = {
      user_id: user.id,
      requester_email: user.email ?? null,
      title: title || null,
      message: message || null,
      created_at: new Date().toISOString(),
    };

    let { error } = await supabase.from('meeting_requests').insert(requestPayload);

    if (error) {
      // If RLS prevents insert, try with a service-role admin client if available
      const adminClient = createAdminClient();
      if (adminClient) {
        const { error: adminInsertError } = await adminClient.from('meeting_requests').insert(requestPayload);
        if (!adminInsertError) {
          return NextResponse.json({ success: true, via: 'service_role' });
        }
        // fall through to email fallback with combined error info
        error = { message: `${error.message}; adminInsertError: ${adminInsertError.message}` } as any;
      }

      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (adminEmails.length && resend) {
        const html = `<p>User <strong>${user.email}</strong> requested a meeting.</p><p><strong>Title:</strong> ${title || '(none)'}</p><p><strong>Message:</strong> ${message || '(none)'}</p>`;
        try {
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'ActionLoop <onboarding@resend.dev>',
            to: adminEmails,
            subject: `Meeting request from ${user.email}`,
            html,
          });
          return NextResponse.json({ success: true, via: 'email' });
        } catch (err) {
          const payload: any = { error: 'Unable to persist or email request' };
          if (process.env.NODE_ENV !== 'production') payload.debug = { insertError: error?.message ?? null, emailError: (err as Error)?.message ?? null };
          return NextResponse.json(payload, { status: 500 });
        }
      }

      const payload: any = { error: 'Unable to save meeting request' };
      if (process.env.NODE_ENV !== 'production') payload.debug = { insertError: error?.message ?? null };
      return NextResponse.json(payload, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? 'Failed' }, { status: 500 });
  }
}
