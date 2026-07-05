import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAdminUser } from '@/lib/auth';
import { verifyTotpCode } from '@/lib/totp';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden', valid: false, required: true }, { status: 403 });
  }

  const body = await req.json();
  const code = String(body.code ?? '').trim();
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const secret = String(metadata.totp_secret ?? '').trim();
  const isConfigured = Boolean(metadata.totp_enabled || secret);

  if (!isConfigured || !secret) {
    return NextResponse.json({ valid: true, required: false });
  }

  if (!code) {
    return NextResponse.json({ valid: false, required: true });
  }

  const valid = verifyTotpCode(secret, code);
  return NextResponse.json({ valid, required: true });
}
