import { NextResponse } from 'next/server';
import { createMeetingAndExtractActions } from '@/app/actions/meetings';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const meetingId = await createMeetingAndExtractActions(formData as unknown as FormData);
    return NextResponse.json({ meetingId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/meetings/create] error', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
