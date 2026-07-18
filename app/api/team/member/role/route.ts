import { NextResponse } from 'next/server';
import { updateTeamMemberRole } from '@/app/actions/team-invites';

export async function POST(req: Request) {
  try {
    const { teamId, memberUserId, role } = await req.json();
    if (!teamId || !memberUserId || !role) {
      return NextResponse.json({ error: 'teamId, memberUserId, and role are required' }, { status: 400 });
    }
    if (role !== 'owner' && role !== 'member') {
      return NextResponse.json({ error: 'role must be owner or member' }, { status: 400 });
    }
    await updateTeamMemberRole(teamId, memberUserId, role);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update role' }, { status: 500 });
  }
}