import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAdminUser } from '@/lib/auth';

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

    const id = String(body.id ?? '').trim();
    const role = typeof body.role === 'string' ? body.role.trim() : null;

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Update profiles table if present
    const updates: any = {};
    if (role) updates.role = role; else updates.role = null;

    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? 'Failed' }, { status: 500 });
  }
}
