import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { getTeamIdForUser } from '@/lib/teams';
import { getPriorOpenItems } from '@/lib/agenda';

export async function GET(req: NextRequest) {
  try {
    const title = req.nextUrl.searchParams.get('title')?.trim() ?? '';
    if (!title || title.length < 3) {
      return NextResponse.json({ suggestion: null });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const adminClient = createAdminClient();
    const client = adminClient ?? supabase;

    const teamId = await getTeamIdForUser(client, user.id, user.email);
    if (!teamId) return NextResponse.json({ suggestion: null });

    const suggestion = await getPriorOpenItems(client, teamId, title);
    return NextResponse.json({ suggestion });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load agenda suggestions' }, { status: 500 });
  }
}