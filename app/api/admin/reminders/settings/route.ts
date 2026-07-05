import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAdminUser } from '@/lib/auth';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('admin_settings')
    .select('key, value')
    .in('key', ['reminder_limit']);

  if (error) {
    return NextResponse.json({ reminderLimit: 10 }, { status: 200 });
  }

  const reminderSetting = data?.find((item: { key: string; value: string | null }) => item.key === 'reminder_limit');
  return NextResponse.json({ reminderLimit: reminderSetting?.value ? Number(reminderSetting.value) : 10 });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const reminderLimit = Number(body.reminderLimit ?? 10);
  const safeLimit = Number.isFinite(reminderLimit) && reminderLimit > 0 ? Math.min(100, Math.floor(reminderLimit)) : 10;

  const { error } = await supabase.from('admin_settings').upsert({ key: 'reminder_limit', value: String(safeLimit) });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reminderLimit: safeLimit });
}
