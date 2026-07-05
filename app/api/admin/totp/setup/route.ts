import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAdminUser } from '@/lib/auth';
import { createTotpQrCodeDataUrl, createTotpSecret } from '@/lib/totp';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const secret = createTotpSecret();
  const qrCode = await createTotpQrCodeDataUrl(user.email ?? 'admin@actionloop.app', secret);

  const { data: updatedUser, error: updateError } = await supabase.auth.updateUser({
    data: {
      ...(user.user_metadata ?? {}),
      totp_secret: secret,
      totp_enabled: true,
    },
  });

  if (updateError || !updatedUser?.user) {
    return NextResponse.json({ error: updateError?.message ?? 'Unable to save TOTP secret' }, { status: 500 });
  }

  return NextResponse.json({ secret, qrCode });
}
