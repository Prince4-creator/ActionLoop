import { NextResponse } from 'next/server';
import { shareMeetingWithUser } from '@/app/actions/meetings';

export async function POST(req: Request) {
  try {
    const { meetingId, email } = await req.json();
    if (!meetingId || !email) {
      return NextResponse.json({ error: 'meetingId and email are required' }, { status: 400 });
    }

    const formData = new FormData();
    formData.append('meeting_id', meetingId);
    formData.append('email', email);

    const result = await shareMeetingWithUser(formData);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to share meeting' }, { status: 500 });
  }
}
