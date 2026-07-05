import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function normalizeSlackChannel(value: string | null | undefined) {
  const trimmed = value?.toString().trim();
  if (!trimmed) return '';
  return trimmed.replace(/\s+/g, '');
}

export async function POST(req: Request) {
  try {
    const { slack_channel_id } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const normalizedChannel = normalizeSlackChannel(slack_channel_id);
    const { error } = await supabase.from('user_settings').upsert({
      user_id: user.id,
      slack_channel_id: normalizedChannel || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (error) {
      return NextResponse.json({ error: 'Unable to save Slack channel' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save Slack channel' }, { status: 500 });
  }
}
