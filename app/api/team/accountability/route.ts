import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isAdminUser } from '@/lib/auth';
import { getTeamIdForUser } from '@/lib/teams';
import { getTeamAccountability } from '@/lib/accountability';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const teamIdParam = searchParams.get('teamId');
  const teamId = teamIdParam || (await getTeamIdForUser(supabase, user.id, user.email));

  if (!teamId) return NextResponse.json({ error: 'No team found' }, { status: 404 });

  try {
    const rows = await getTeamAccountability(supabase, teamId);
    return NextResponse.json({ teamId, rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compute accountability' },
      { status: 500 }
    );
  }
}