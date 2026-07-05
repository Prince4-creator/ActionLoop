import { NextResponse } from 'next/server';
import { scheduledSendReminders } from '@/app/actions/reminders';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const maxRetries = typeof body.maxRetries === 'number' ? body.maxRetries : 3;
    const result = await scheduledSendReminders(maxRetries);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? 'Failed' }, { status: 500 });
  }
}
