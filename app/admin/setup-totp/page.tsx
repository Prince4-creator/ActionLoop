import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { isAdminUser } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import Link from 'next/link';
import SetupTotpClient from './setup-totp-client';

export default async function SetupTotpPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (!isAdminUser(user)) redirect('/dashboard');

  return (
    <AppShell user={user} currentPath="/admin" title="Admin" description="Enable authenticator verification">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-3xl border border-slate-200/60 bg-white/95 p-8 shadow-xl shadow-slate-200/50 backdrop-blur dark:border-slate-700/70 dark:bg-slate-950/85 dark:shadow-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-700 dark:text-slate-400">Two-factor setup</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">Enable Google Authenticator</h1>
              <p className="mt-3 text-lg leading-8 text-slate-700 dark:text-slate-300">Set up a one-time code for your admin sign-in so password-only access is no longer enough.</p>
            </div>
            <Link href="/admin" className="rounded-2xl border border-slate-300 bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:border-slate-700 dark:bg-slate-900">
              Back to admin
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200/60 bg-slate-50 p-8 shadow-sm dark:border-slate-700/60 dark:bg-slate-950/70">
          <p className="text-sm text-slate-600 dark:text-slate-300">This will create a new authenticator secret and QR code for your admin account.</p>
          <div className="mt-4">
            <SetupTotpClient />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
