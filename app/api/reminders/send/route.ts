import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAdminUser } from '@/lib/auth';
import { sendReminders, sendReminderForItem } from '@/app/actions/reminders';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({} as Record<string, unknown>))) as Record<string, unknown>;
    const actionItemId = typeof body?.actionItemId === 'string' ? body.actionItemId : '';

    if (actionItemId) {
      const result = await sendReminderForItem(actionItemId);
      return NextResponse.json(result);
    }

    const result = await sendReminders();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to send reminders' }, { status: 500 });
  }
}
