import { NextResponse } from 'next/server';
import { removeTeamMember } from '@/app/actions/team-invites';

export async function POST(req: Request) {
  try {
    const { teamId, memberUserId } = await req.json();
    if (!teamId || !memberUserId) {
      return NextResponse.json({ error: 'teamId and memberUserId are required' }, { status: 400 });
    }
    await removeTeamMember(teamId, memberUserId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to remove member' }, { status: 500 });
  }
}