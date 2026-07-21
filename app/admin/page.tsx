import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { isAdminUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/admin';
import { AppShell } from '@/components/app-shell';
import AdminDashboardClient from './admin-dashboard-client';
import type { AuditLogEntry } from '@/lib/audit';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (!isAdminUser(user)) redirect('/dashboard');

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const [
    profilesResult,
    meetingRequestsResult,
    teamsResult,
    meetingsResult,
    actionItemsResult,
    pendingActionItemsResult,
    auditLogResult,
  ] = await Promise.all([
    // `banned_until` and `suspended_reason` do NOT live on `profiles` — ban
    // status is stored on Supabase's internal `auth.users` table. Selecting
    // them here throws a "column does not exist" error and breaks the whole
    // admin user list. Fetch ban status separately below instead.
    supabase.from('profiles').select('id, email, role, updated_at').order('email'),
    client.from('meeting_requests').select('id', { count: 'exact', head: true }),
    client.from('teams').select('id', { count: 'exact', head: true }),
    client.from('meetings').select('id', { count: 'exact', head: true }),
    client.from('action_items').select('id', { count: 'exact', head: true }),
    client.from('action_items').select('id', { count: 'exact', head: true }).in('status', ['pending', 'overdue']),
    client
      .from('admin_audit_log')
      .select('id, actor_email, action, target_type, target_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const { data: profiles, error } = profilesResult;
  const { count: meetingRequestsCount, error: meetingRequestsError } = meetingRequestsResult;
  const { count: teamsCount } = teamsResult;
  const { count: meetingsCount } = meetingsResult;
  const { count: actionItemsCount } = actionItemsResult;
  const { count: pendingActionItemsCount } = pendingActionItemsResult;
  const { data: auditLogData } = auditLogResult;

  const errorMessage = error ? String(error.message || 'Unable to load admin user data.') : null;
  const schemaError = errorMessage?.includes('profiles') || errorMessage?.includes('schema cache');

  // Ban status lives on auth.users, which only the service-role client can
  // read via the admin API. Build an id -> banned_until map and merge it
  // into the profiles we already fetched, so the client's isSuspended()
  // check reflects the real state instead of always reading undefined.
  //
  // NOTE: listUsers() paginates (default 50/page). This loop walks every
  // page so large workspaces don't silently miss users past page 1.
  const bannedUntilById = new Map<string, string | null>();
  if (adminClient) {
    try {
      let page = 1;
      const perPage = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: pageData, error: listError } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (listError) {
          console.error('[admin/page] listUsers failed', listError);
          break;
        }
        for (const authUser of pageData?.users ?? []) {
          bannedUntilById.set(authUser.id, authUser.banned_until ?? null);
        }
        if (!pageData?.users?.length || pageData.users.length < perPage) break;
        page += 1;
      }
    } catch (err) {
      console.error('[admin/page] listUsers threw', err);
    }
  }

  const profilesWithBanStatus = (profiles ?? []).map((p) => ({
    ...p,
    banned_until: bannedUntilById.get(p.id) ?? null,
  }));

  const adminCount = profilesWithBanStatus.filter((p: any) => p.role === 'admin').length;

  return (
    <AppShell user={user} currentPath="/admin" title="Admin" description="Manage users and workspace access">
      <AdminDashboardClient
        adminEmail={user.email ?? ''}
        currentUserId={user.id}
        profiles={profilesWithBanStatus}
        errorMessage={errorMessage}
        schemaError={Boolean(schemaError)}
        auditLog={(auditLogData ?? []) as AuditLogEntry[]}
        stats={{
          totalUsers: profilesWithBanStatus.length,
          adminCount,
          meetingRequests: meetingRequestsError ? null : (meetingRequestsCount ?? 0),
          teams: teamsCount ?? 0,
          meetings: meetingsCount ?? 0,
          actionItems: actionItemsCount ?? 0,
          pendingActionItems: pendingActionItemsCount ?? 0,
        }}
      />
    </AppShell>
  );
}