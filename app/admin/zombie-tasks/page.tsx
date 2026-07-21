import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { isAdminUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/admin';
import { AppShell } from '@/components/app-shell';
import Link from 'next/link';
import { Skull } from 'lucide-react';

export default async function ZombieTasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (!isAdminUser(user)) redirect('/dashboard');

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  // Workspace-wide: every team, not just the ones this admin happens to
  // belong to — mirrors how app/admin/page.tsx pulls global counts.
  const { data: allTeams } = await client.from('teams').select('id');
  const allTeamIds = (allTeams ?? []).map((t) => t.id);

  const { data: meetingsInScope } = allTeamIds.length
    ? await client.from('meetings').select('id, title, team_id').in('team_id', allTeamIds)
    : { data: [] as Array<{ id: string; title: string | null; team_id: string | null }> };
  const meetingIds = (meetingsInScope ?? []).map((m) => m.id);
  const meetingTitleById = new Map((meetingsInScope ?? []).map((m) => [m.id, m.title]));

  const { data: zombieItems, error } = meetingIds.length
    ? await client
        .from('action_items')
        .select('id, description, assignee_email, due_date, status, recurrence_count, meeting_id')
        .in('meeting_id', meetingIds)
        .eq('is_zombie', true)
        .neq('status', 'done')
        .order('recurrence_count', { ascending: false })
    : { data: [] as Array<{ id: string; description: string; assignee_email: string; due_date: string | null; status: string; recurrence_count: number; meeting_id: string }>, error: null };

  const schemaMissing = error?.message?.toLowerCase().includes('is_zombie') || error?.message?.toLowerCase().includes('recurrence_count');

  return (
    <AppShell user={user} currentPath="/admin/zombie-tasks" title="Zombie tasks" description="Action items that keep resurfacing without closing">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Skull className="h-5 w-5 text-fuchsia-400" /> Zombie tasks
          </h1>
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">Back to admin</Link>
        </div>

        <p className="text-sm text-muted-foreground">
          These action items have resurfaced across three or more meetings without ever being marked done — the same ask, apparently never closing.
        </p>

        {schemaMissing ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm text-foreground">
            The database is missing the zombie-tracking columns. Apply <code>supabase/migrations/20260721010000_zombie_action_items.sql</code> first.
          </div>
        ) : (zombieItems ?? []).length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-muted-foreground">
            No zombie tasks right now — nothing has recurred 3+ times unresolved.
          </div>
        ) : (
          <div className="space-y-3">
            {(zombieItems ?? []).map((item) => (
              <div key={item.id} className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{item.description}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.assignee_email} · {meetingTitleById.get(item.meeting_id) || 'Untitled meeting'} ·{' '}
                      {item.due_date ? `Due ${new Date(item.due_date).toLocaleDateString()}` : 'No due date'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-fuchsia-500/20 px-3 py-1 text-xs font-semibold text-fuchsia-200">
                    Recurred {item.recurrence_count}×
                  </span>
                </div>
                <Link
                  href={`/meetings/${item.meeting_id}`}
                  className="mt-3 inline-block text-sm font-medium text-fuchsia-300 hover:text-fuchsia-200"
                >
                  Open meeting →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}