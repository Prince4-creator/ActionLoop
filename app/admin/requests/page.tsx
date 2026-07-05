import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { isAdminUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/admin';
import { AppShell } from '@/components/app-shell';
import Link from 'next/link';

export default async function RequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  if (!user) redirect('/login');
  if (!isAdminUser(user)) redirect('/dashboard');

  const { data: requests, error } = await client.from('meeting_requests').select('*').order('created_at', { ascending: false });

  return (
    <AppShell user={user} currentPath="/admin/requests" title="Meeting requests">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Meeting requests</h1>
          <Link href="/admin">Back</Link>
        </div>

        {error ? (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-600">Unable to read `meeting_requests` table: {String(error.message)}</div>
        ) : requests?.length ? (
          <div className="overflow-x-auto rounded-2xl border p-4">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="text-left text-sm text-slate-600">
                  <th className="w-2/5 px-2 py-2">Title</th>
                  <th className="w-2/5 px-2 py-2">Message</th>
                  <th className="w-1/5 px-2 py-2">Requested by</th>
                  <th className="w-1/5 px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r: any) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 px-2 text-sm break-words whitespace-normal">{r.title ?? '(none)'}</td>
                    <td className="py-2 px-2 text-sm break-words whitespace-normal">{r.message ?? '-'}</td>
                    <td className="py-2 px-2 text-sm break-words whitespace-normal">{r.requester_email ?? r.user_id}</td>
                    <td className="py-2 px-2 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <form action="/api/admin/requests/convert" method="post" className="inline">
                          <input type="hidden" name="id" value={r.id} />
                          <button className="rounded-2xl border px-3 py-1 text-sm">Convert</button>
                        </form>
                        <form action="/api/admin/requests/delete" method="post" className="inline">
                          <input type="hidden" name="id" value={r.id} />
                          <button className="rounded-2xl border px-3 py-1 text-sm">Delete</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-600">No meeting requests found.</div>
        )}
      </div>
    </AppShell>
  );
}
