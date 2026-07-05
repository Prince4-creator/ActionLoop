import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { WebClient } from '@slack/web-api';

function normalizeSlackChannel(value: string | null | undefined) {
  const trimmed = value?.toString().trim();
  if (!trimmed) return '';
  return trimmed.replace(/\s+/g, '');
}

export async function POST(req: Request) {
  try {
    const { channelId, text } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: settings } = await supabase
      .from('user_settings')
      .select('slack_access_token, slack_channel_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!settings?.slack_access_token) {
      return NextResponse.json({ error: 'Slack is not connected' }, { status: 400 });
    }

    const requestedChannel = normalizeSlackChannel(channelId) || normalizeSlackChannel(settings?.slack_channel_id);
    if (!requestedChannel) {
      return NextResponse.json({ error: 'Enter a Slack channel ID like C0123ABC or a public channel such as #general.' }, { status: 400 });
    }

    const web = new WebClient(settings.slack_access_token);
    const result = await web.chat.postMessage({
      channel: requestedChannel,
      text: text || 'ActionLoop test message ✅',
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send test message';
    if (message.includes('channel_not_found') || message.includes('not_in_channel')) {
      return NextResponse.json({ error: 'The Slack bot could not reach that channel. Invite the app to the channel and use the channel ID (for example C0123ABC).' }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
