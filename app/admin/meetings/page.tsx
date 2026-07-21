import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { isAdminUser } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, AlertTriangle, ArrowLeft } from 'lucide-react';

type MeetingRow = {
  id: string;
  title: string | null;
  summary: string | null;
  user_id: string | null;
  team_id: string | null;
  created_at?: string;
  outcome_score?: number | null;
};

export default async function AdminMeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (!isAdminUser(user)) redirect('/dashboard');

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const resolvedSearchParams = await searchParams;
  const query = String(resolvedSearchParams?.q ?? '').trim();
  const safeQuery = query.replace(/'/g, "''").replace(/%/g, '\\%');

  let meetingsQuery = client
    .from('meetings')
    .select('id, title, summary, user_id, team_id, created_at, outcome_score')
    .order('created_at', { ascending: false });

  if (safeQuery) {
    meetingsQuery = meetingsQuery.or(`title.ilike.%${safeQuery}%,summary.ilike.%${safeQuery}%`);
  }

  const { data: meetingsData, error: meetingsError } = await meetingsQuery;
  const meetings = (meetingsData ?? []) as MeetingRow[];

  // Batch-load everything needed to avoid N+1 queries per meeting.
  const meetingIds = meetings.map((m) => m.id);
  const teamIds = Array.from(new Set(meetings.map((m) => m.team_id).filter(Boolean))) as string[];
  const ownerIds = Array.from(new Set(meetings.map((m) => m.user_id).filter(Boolean))) as string[];

  const [{ data: teamsData }, { data: actionItemsData }] = await Promise.all([
    teamIds.length
      ? client.from('teams').select('id, name').in('id', teamIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
    meetingIds.length
      ? client.from('action_items').select('id, meeting_id, status, due_date').in('meeting_id', meetingIds)
      : Promise.resolve({ data: [] as Array<{ id: string; meeting_id: string; status: string; due_date: string | null }> }),
  ]);

  const teamNameById = new Map((teamsData ?? []).map((t) => [t.id, t.name ?? 'Untitled team']));

  let ownerEmailById = new Map<string, string>();
  if (adminClient && ownerIds.length) {
    try {
      const { data: authUsers } = await adminClient.auth.admin.listUsers();
      ownerEmailById = new Map(
        (authUsers?.users ?? [])
          .filter((u) => ownerIds.includes(u.id))
          .map((u) => [u.id, u.email ?? 'Unknown'])
      );
    } catch {
      // fall back to blank owner labels below
    }
  }

  const now = new Date();
  const itemStatsByMeeting = new Map<string, { total: number; done: number; overdue: number }>();
  for (const item of actionItemsData ?? []) {
    const stats = itemStatsByMeeting.get(item.meeting_id) ?? { total: 0, done: 0, overdue: 0 };
    stats.total += 1;
    if (item.status === 'done') stats.done += 1;
    if (item.status !== 'done' && item.due_date && new Date(item.due_date) < now) stats.overdue += 1;
    itemStatsByMeeting.set(item.meeting_id, stats);
  }

  const totalOverdue = Array.from(itemStatsByMeeting.values()).reduce((sum, s) => sum + s.overdue, 0);

  return (
    <AppShell user={user} currentPath="/admin/meetings" title="All meetings" description="Every meeting across every team">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to admin
          </Link>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full">{meetings.length} meetings</Badge>
            {totalOverdue > 0 ? (
              <Badge className="rounded-full bg-red-100 text-red-800">{totalOverdue} overdue items</Badge>
            ) : null}
          </div>
        </div>

        <form method="GET" className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex-1">
            <label htmlFor="q" className="sr-only">Search meetings</label>
            <input
              id="q"
              name="q"
              defaultValue={query}
              placeholder="Search across every team's meetings by title or summary"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <button type="submit" className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
            Search
          </button>
        </form>

        {meetingsError ? (
          <Card className="rounded-3xl border-dashed p-6 text-sm text-slate-600">
            Unable to load meetings: {meetingsError.message}
          </Card>
        ) : meetings.length > 0 ? (
          <div className="grid gap-3">
            {meetings.map((meeting) => {
              const stats = itemStatsByMeeting.get(meeting.id) ?? { total: 0, done: 0, overdue: 0 };
              const teamName = meeting.team_id ? teamNameById.get(meeting.team_id) ?? 'Unknown team' : 'No team';
              const ownerEmail = meeting.user_id ? ownerEmailById.get(meeting.user_id) ?? 'Unknown owner' : 'No owner';

              return (
                <Link key={meeting.id} href={`/meetings/${meeting.id}`}>
                  <Card className="rounded-3xl border-white/60 bg-white/70 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md backdrop-blur dark:bg-slate-900/70">
                    <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold">{meeting.title || 'Untitled Meeting'}</h2>
                          <Badge variant="outline" className="rounded-full">{teamName}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{ownerEmail}</p>
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{meeting.summary || 'No summary available yet.'}</p>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <div className="flex items-center gap-2">
                          <Badge className="rounded-full bg-emerald-100 text-emerald-800">{stats.done}/{stats.total} done</Badge>
                          {stats.overdue > 0 ? (
                            <Badge className="rounded-full bg-red-100 text-red-800">
                              <AlertTriangle className="mr-1 h-3 w-3" /> {stats.overdue} overdue
                            </Badge>
                          ) : null}
                        </div>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <CalendarDays className="h-4 w-4" />
                          {meeting.created_at ? new Date(meeting.created_at).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="rounded-3xl border-dashed border-slate-200 bg-white/70 p-10 text-center shadow-sm backdrop-blur">
            <p className="font-medium">{query ? 'No meetings match your search.' : 'No meetings in the workspace yet.'}</p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}