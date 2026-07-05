import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const redirectUri = `${requestUrl.origin}/api/auth/slack/callback`;
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID || '',
    scope: 'chat:write',
    redirect_uri: redirectUri,
    state: user.id,
  });

  return NextResponse.json({ url: `https://slack.com/oauth/v2/authorize?${params.toString()}` });
}
