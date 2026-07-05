import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  try {
    const { nudge_preference } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { error } = await supabase.from('user_settings').upsert({
      user_id: user.id,
      nudge_preference,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (error) {
      // Return a stable, user-facing message in production while keeping onConflict for safety.
      return NextResponse.json({ error: 'Preferences are unavailable until the workspace tables are created.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save preference' }, { status: 500 });
  }
}
