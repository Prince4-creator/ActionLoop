import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { isAdminUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/admin';
import { AppShell } from '@/components/app-shell';
import Link from 'next/link';
import SetupTotpClient from './setup-totp/setup-totp-client';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (!isAdminUser(user)) redirect('/dashboard');

  // Try to read profiles table; if it doesn't exist, show message
  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;
  const { data: profiles, error } = await supabase.from('profiles').select('id, email, role, updated_at').order('email');
  const { data: meetingRequestsMeta, error: meetingRequestsError, count: meetingRequestsCount } = await client
    .from('meeting_requests')
    .select('id', { count: 'exact', head: true });

  const errorMessage = error
    ? String(error.message || 'Unable to load admin user data.')
    : null;
  const meetingRequestCount = typeof meetingRequestsCount === 'number' ? meetingRequestsCount : null;
  const meetingRequestsAvailable = meetingRequestsError == null;

  const schemaError = errorMessage?.includes('profiles') || errorMessage?.includes('schema cache');

  return (
    <AppShell user={user} currentPath="/admin" title="Admin" description="Manage users and workspace access">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="rounded-2xl border border-slate-200/60 bg-white/95 p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-950/85">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Admin dashboard</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Workspace users</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Review and update user roles for your admin workspace.</p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-300 bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:border-slate-700 dark:bg-slate-900"
            >
              Back to dashboard
            </Link>
          </div>
        </section>

        {meetingRequestsAvailable ? (
          <section className="rounded-2xl border border-slate-200/60 bg-slate-50 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-950/70">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Meeting requests</p>
                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-100">{meetingRequestCount ?? 0} pending</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Review meeting requests and convert them into meetings.</p>
              </div>
              <Link
                href="/admin/requests"
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-900"
              >
                View requests
              </Link>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200/60 bg-slate-50 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-950/70">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Two-factor authentication</p>
            <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">Enable Google Authenticator for admin sign-in</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Set up a one-time code so password-only access is no longer enough.</p>
          </div>
          <div className="mt-3">
            <SetupTotpClient />
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-5 text-sm text-slate-800 shadow-sm dark:border-amber-400/60 dark:bg-slate-900/70 dark:text-slate-200">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-base font-semibold text-amber-950 dark:bg-amber-400/20 dark:text-amber-200">!</div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-300">Admin data unavailable</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">Your Supabase project does not currently have a `profiles` table available for the admin dashboard.</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{schemaError ? 'Please verify that the `profiles` table exists in your Supabase database and that your schema is up to date.' : errorMessage}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/dashboard"
                    className="rounded-xl border border-slate-300 bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:border-slate-700 dark:bg-slate-900"
                  >
                    Back to dashboard
                  </Link>
                  <a
                    href="https://supabase.com/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Supabase docs
                  </a>
                </div>
              </div>
            </div>
          </section>
        ) : profiles?.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50 shadow-sm dark:border-slate-700/70 dark:bg-slate-950/90">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="bg-slate-100 text-left text-sm font-semibold text-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p: any) => (
                  <tr key={p.id} className="border-t border-slate-200 last:border-b hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-900/80">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{p.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{p.role ?? 'member'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{p.updated_at ? new Date(p.updated_at).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3">
                      <form action="/api/admin/users/update" method="post" className="inline-block">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="role" value={p.role === 'admin' ? '' : 'admin'} />
                        <button className="rounded-xl border border-slate-300 bg-slate-950 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:border-slate-700 dark:bg-slate-900">
                          {p.role === 'admin' ? 'Revoke admin' : 'Make admin'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/90 p-5 text-sm text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/90 dark:text-slate-200">
            No users found in `profiles` table.
          </div>
        )}
      </div>
    </AppShell>
  );
}