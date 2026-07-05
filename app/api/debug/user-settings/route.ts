import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) return NextResponse.json({ error: 'Unable to fetch user', details: userError.message }, { status: 500 });
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('user_id, slack_access_token, slack_channel_id, nudge_preference')
      .eq('user_id', user.id)
      .maybeSingle();

    return NextResponse.json({ user, settings, settingsError: settingsError?.message ?? null });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 });
  }
}
