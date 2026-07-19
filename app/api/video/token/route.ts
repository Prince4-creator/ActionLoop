import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { room } = await req.json().catch(() => ({}));
  if (!room) return NextResponse.json({ error: 'room is required' }, { status: 400 });

  const appId = process.env.JAAS_APP_ID;
  const keyId = process.env.JAAS_API_KEY_ID;
  const privateKey = (process.env.JAAS_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

  if (!appId || !keyId || !privateKey) {
    return NextResponse.json({ error: 'JaaS credentials are not configured on the server' }, { status: 500 });
  }

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    iat: now,
    exp: now + 60 * 60 * 2,
    nbf: now - 5,
    sub: appId,
    room,
    context: {
      user: {
        id: user.id,
        name: user.email?.split('@')[0] ?? 'Guest',
        email: user.email ?? '',
        moderator: 'true',
      },
      features: {
        livestreaming: 'false',
        recording: 'false',
        transcription: 'false',
        'outbound-call': 'false',
      },
    },
  };

  try {
    const token = jwt.sign(payload, privateKey, {
      algorithm: 'RS256',
      header: { kid: keyId, typ: 'JWT', alg: 'RS256' },
    });

    return NextResponse.json({ token, appId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unable to sign JaaS token' },
      { status: 500 }
    );
  }
}