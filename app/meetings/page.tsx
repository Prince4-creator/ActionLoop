import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock3 } from 'lucide-react';
import { getTeamIdForUser } from '@/lib/teams';

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const resolvedSearchParams = await searchParams;
  const query = String(resolvedSearchParams?.q ?? '').trim();
  const safeQuery = query.replace(/'/g, "''").replace(/%/g, '\\%');
  const searchFilter = safeQuery
    ? `title.ilike.%${safeQuery}%,summary.ilike.%${safeQuery}%,notes.ilike.%${safeQuery}%`
    : null;

  const teamId = await getTeamIdForUser(client, user.id, user.email);
  const baseSelect = 'id, title, summary, notes, created_at, outcome_score';
  const fallbackSelect = 'id, title, summary, created_at, outcome_score';

  let meetings: Array<{ id: string; title: string | null; summary: string | null; notes?: string | null; created_at?: string; outcome_score?: number; }> | null = null;

  try {
    let meetingsQuery = client.from('meetings').select(baseSelect);
    if (teamId) {
      meetingsQuery = meetingsQuery.eq('team_id', teamId);
    }
    if (searchFilter) {
      meetingsQuery = meetingsQuery.or(searchFilter);
    }
    meetingsQuery = meetingsQuery.order('created_at', { ascending: false });
    const response = await meetingsQuery;
    meetings = response.data;
  } catch {
    let meetingsQuery = client.from('meetings').select(fallbackSelect);
    if (teamId) {
      meetingsQuery = meetingsQuery.eq('team_id', teamId);
    }
    if (searchFilter) {
      meetingsQuery = meetingsQuery.or(`title.ilike.%${safeQuery}%,summary.ilike.%${safeQuery}%`);
    }
    meetingsQuery = meetingsQuery.order('created_at', { ascending: false });
    const response = await meetingsQuery;
    meetings = response.data;
  }

  if ((!meetings || meetings.length === 0) && !teamId && user.id) {
    try {
      const fallbackQuery = client
        .from('meetings')
        .select(baseSelect)
        .eq('user_id', user.id);
      if (searchFilter) fallbackQuery.or(searchFilter);
      const fallback = await fallbackQuery.order('created_at', { ascending: false });
      meetings = fallback.data ?? meetings;
    } catch {
      const fallbackQuery = client
        .from('meetings')
        .select(fallbackSelect)
        .eq('user_id', user.id);
      if (searchFilter) fallbackQuery.or(`title.ilike.%${safeQuery}%,summary.ilike.%${safeQuery}%`);
      const fallback = await fallbackQuery.order('created_at', { ascending: false });
      meetings = fallback.data ?? meetings;
    }
  }

  return (
    <AppShell user={user} currentPath="/meetings" title="Meetings" description="Browse your meeting history">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <form method="GET" className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex-1">
            <label htmlFor="q" className="sr-only">Search meetings</label>
            <input
              id="q"
              name="q"
              defaultValue={query}
              placeholder="Search meetings by title, summary, or notes"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <button type="submit" className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
            Search
          </button>
        </form>

        {query ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200">
            Showing results for <span className="font-semibold">{query}</span>. Clear the search to browse all meetings.
          </div>
        ) : null}

        {(meetings ?? []).length > 0 ? (
          (meetings ?? []).map((meeting) => (
            <Link key={meeting.id} href={`/meetings/${meeting.id}`}>
              <Card className="rounded-3xl border-white/60 bg-white/70 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md backdrop-blur dark:bg-slate-900/70">
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{meeting.title || 'Untitled Meeting'}</h2>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{meeting.summary || meeting.notes || 'No summary available yet.'}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Badge variant="outline" className="rounded-full">{meeting.outcome_score ? `Score ${meeting.outcome_score}%` : 'New'}</Badge>
                    <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {meeting.created_at ? new Date(meeting.created_at).toLocaleDateString() : 'Recent'}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <Card className="rounded-3xl border-dashed border-slate-200 bg-white/70 p-10 text-center shadow-sm backdrop-blur">
            <Clock3 className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
            <p className="font-medium">{query ? 'No meetings match your search.' : 'No meetings yet.'}</p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}