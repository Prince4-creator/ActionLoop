import { NextResponse } from 'next/server';
import { inviteTeamMember } from '@/app/actions/team-invites';

export async function POST(req: Request) {
  try {
    const { teamId, email } = await req.json();
    if (!teamId || !email) {
      return NextResponse.json({ error: 'teamId and email are required' }, { status: 400 });
    }

    await inviteTeamMember(teamId, email);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invite failed' }, { status: 500 });
  }
}
