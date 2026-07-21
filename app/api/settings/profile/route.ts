import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  try {
    const { full_name } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!user.email) return NextResponse.json({ error: 'No email on account' }, { status: 400 });

    const name = typeof full_name === 'string' ? full_name.trim().slice(0, 120) : '';

    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: name || null, updated_at: new Date().toISOString() })
      .eq('email', user.email)
      .select('id, full_name');

    if (error) {
      return NextResponse.json({ error: error.message ?? 'Unable to save profile' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Profile not found or update was blocked' }, { status: 404 });
    }

    return NextResponse.json({ success: true, full_name: data[0].full_name });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save profile' }, { status: 500 });
  }
}