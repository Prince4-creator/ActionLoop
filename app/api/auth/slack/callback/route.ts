import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const isUuid = (value: string | null): value is string =>
  Boolean(value && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value));

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const error = requestUrl.searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(new URL('/settings?slack=error', requestUrl.origin));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? (isUuid(state) ? state : null);

  if (!userId) {
    return NextResponse.redirect(new URL('/login', requestUrl.origin));
  }

  const redirectUri = `${requestUrl.origin}/api/auth/slack/callback`;
  const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.SLACK_CLIENT_ID || '',
      client_secret: process.env.SLACK_CLIENT_SECRET || '',
      redirect_uri: redirectUri,
      state: state || '',
    }),
  });

  const tokenPayload = await tokenResponse.json();
  const accessToken = tokenPayload?.bot_access_token || tokenPayload?.access_token;
  const incomingWebhook = tokenPayload?.incoming_webhook;
  const channelId = incomingWebhook?.channel_id ?? null;

  if (!accessToken) {
    return NextResponse.redirect(new URL('/settings?slack=error', requestUrl.origin));
  }

  const { error: settingsError } = await supabase.from('user_settings').upsert({
    user_id: userId,
    slack_access_token: accessToken,
    slack_channel_id: channelId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (settingsError) {
    return NextResponse.redirect(new URL('/settings?slack=error', requestUrl.origin));
  }

  return NextResponse.redirect(new URL('/settings?slack=connected', requestUrl.origin));
}
