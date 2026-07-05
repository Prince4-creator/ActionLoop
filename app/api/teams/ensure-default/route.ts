import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { ensureDefaultTeamForUser } from '@/lib/teams';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const teamId = await ensureDefaultTeamForUser(supabase, user.id, user.email);
    return NextResponse.json({ teamId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create team' }, { status: 500 });
  }
}
