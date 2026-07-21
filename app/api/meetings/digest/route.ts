import { NextResponse } from 'next/server';
import { sendMeetingDigest } from '@/app/actions/meetings';

export async function POST(req: Request) {
  try {
    const { meetingId, emails } = await req.json();
    if (!meetingId || !emails) {
      return NextResponse.json({ error: 'meetingId and emails are required' }, { status: 400 });
    }

    const formData = new FormData();
    formData.append('meeting_id', meetingId);
    formData.append('emails', emails);

    const result = await sendMeetingDigest(formData);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to send digest' }, { status: 500 });
  }
}