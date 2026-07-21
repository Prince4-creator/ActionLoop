import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { isAdminUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/admin';
import { AppShell } from '@/components/app-shell';
import { computeDebtByAssignee, debtLevel } from '@/lib/debt';
import Link from 'next/link';
import { Flame, AlertTriangle } from 'lucide-react';

function computeStreak(events: { was_on_time: boolean }[]) {
  let streak = 0;
  for (const e of events) {
    if (!e.was_on_time) break;
    streak++;
  }
  return streak;
}

function streakBadge(streak: number) {
  if (streak >= 14) return '🔥🔥🔥';
  if (streak >= 7) return '🔥🔥';
  if (streak >= 3) return '🔥';
  return null;
}

export default async function AccountabilityPage() {
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
    ? await client.from('meetings').select('id, team_id').in('team_id', allTeamIds)
    : { data: [] as Array<{ id: string; team_id: string | null }> };
  const meetingIds = (meetingsInScope ?? []).map((m) => m.id);

  const { data: overdueItems } = meetingIds.length
    ? await client
        .from('action_items')
        .select('assignee_email, due_date')
        .in('meeting_id', meetingIds)
        .neq('status', 'done')
    : { data: [] as Array<{ assignee_email: string; due_date: string | null }> };

  const debtByAssignee = computeDebtByAssignee(
    (overdueItems ?? []).filter((item) => item.assignee_email && item.assignee_email !== 'unassigned@example.com')
  );

  const { data: events } = allTeamIds.length
    ? await client
        .from('completion_events')
        .select('assignee_email, was_on_time, completed_at')
        .in('team_id', allTeamIds)
        .order('completed_at', { ascending: false })
    : { data: [] as Array<{ assignee_email: string; was_on_time: boolean; completed_at: string }> };

  const eventsByAssignee = new Map<string, Array<{ was_on_time: boolean }>>();
  for (const event of events ?? []) {
    const list = eventsByAssignee.get(event.assignee_email) ?? [];
    list.push({ was_on_time: event.was_on_time });
    eventsByAssignee.set(event.assignee_email, list);
  }

  const allAssignees = new Set([...debtByAssignee.keys(), ...eventsByAssignee.keys()]);

  const rows = Array.from(allAssignees).map((email) => {
    const debt = debtByAssignee.get(email) ?? 0;
    const streak = computeStreak(eventsByAssignee.get(email) ?? []);
    return { email, debt, streak, level: debtLevel(debt) };
  }).sort((a, b) => b.debt - a.debt);

  const maxDebt = Math.max(1, ...rows.map((r) => r.debt));

  return (
    <AppShell user={user} currentPath="/admin/accountability" title="Accountability" description="Streaks and meeting debt across the workspace">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">Accountability</h1>
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">Back to admin</Link>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-400" /> Meeting debt by person
          </h2>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No overdue items right now — everyone's clear.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.email}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-foreground">
                      {row.email}
                      {streakBadge(row.streak) ? (
                        <span title={`${row.streak}-item on-time streak`}>{streakBadge(row.streak)} {row.streak}</span>
                      ) : null}
                    </span>
                    <span className="font-semibold text-muted-foreground">{row.debt.toFixed(1)} pts</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={
                        row.level === 'high'
                          ? 'h-full rounded-full bg-red-500'
                          : row.level === 'medium'
                          ? 'h-full rounded-full bg-amber-400'
                          : 'h-full rounded-full bg-emerald-500'
                      }
                      style={{ width: `${Math.max(4, (row.debt / maxDebt) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Flame className="h-4 w-4 text-orange-400" /> Current on-time streaks
          </h2>
          {rows.filter((r) => r.streak > 0).length === 0 ? (
            <p className="text-sm text-muted-foreground">No active streaks yet — complete an item on time to start one.</p>
          ) : (
            <ul className="space-y-2">
              {rows
                .filter((r) => r.streak > 0)
                .sort((a, b) => b.streak - a.streak)
                .map((row) => (
                  <li key={row.email} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                    <span className="text-foreground">{row.email}</span>
                    <span className="font-semibold text-orange-300">{streakBadge(row.streak)} {row.streak} in a row</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}