import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { isAdminUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/admin';
import { getTeamIdForUser } from '@/lib/teams';
import { AppShell } from '@/components/app-shell';
import Link from 'next/link';

export default async function ZombieTasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (!isAdminUser(user)) redirect('/dashboard');

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;
  const teamId = await getTeamIdForUser(supabase, user.id, user.email);

  const { data: meetings } = teamId
    ? await client.from('meetings').select('id, title').eq('team_id', teamId)
    : { data: [] as Array<{ id: string; title: string | null }> };

  const meetingIds = (meetings ?? []).map((m) => m.id);
  const meetingTitleById = new Map((meetings ?? []).map((m) => [m.id, m.title]));

  const { data: zombies, error } = meetingIds.length
    ? await client
        .from('action_items')
        .select('id, description, assignee_email, due_date, status, recurrence_count, meeting_id, created_at')
        .in('meeting_id', meetingIds)
        .eq('is_zombie', true)
        .order('recurrence_count', { ascending: false })
    : { data: [] as any[], error: null };

  return (
    <AppShell
      user={user}
      currentPath="/admin/zombie-tasks"
      title="Zombie tasks"
      description="Action items that keep getting re-promised and never done"
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Zombie tasks</h1>
          <Link href="/admin">Back</Link>
        </div>

        {error ? (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-600">
            Unable to load zombie tasks: {String(error.message)}
          </div>
        ) : zombies?.length ? (
          <div className="overflow-x-auto rounded-2xl border p-4">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="text-left text-sm text-slate-600">
                  <th className="w-2/5 px-2 py-2">Task</th>
                  <th className="w-1/5 px-2 py-2">Assignee</th>
                  <th className="w-1/5 px-2 py-2">Meeting</th>
                  <th className="w-1/5 px-2 py-2">Asked</th>
                </tr>
              </thead>
              <tbody>
                {zombies.map((z: any) => (
                  <tr key={z.id} className="border-t">
                    <td className="py-2 px-2 text-sm break-words whitespace-normal">{z.description}</td>
                    <td className="py-2 px-2 text-sm break-words whitespace-normal">{z.assignee_email}</td>
                    <td className="py-2 px-2 text-sm break-words whitespace-normal">
                      <Link href={`/meetings/${z.meeting_id}`} className="underline">
                        {meetingTitleById.get(z.meeting_id) ?? 'View meeting'}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-sm">{z.recurrence_count}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-600">
            No zombie tasks yet — nothing has been re-promised 3+ times without being finished.
          </div>
        )}
      </div>
    </AppShell>
  );
}