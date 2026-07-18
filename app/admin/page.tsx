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

  const adminCount = (profiles ?? []).filter((p: any) => p.role === 'admin').length;

  return (
    <AppShell user={user} currentPath="/admin" title="Admin" description="Manage users and workspace access">
      <AdminDashboardClient
        adminEmail={user.email ?? ''}
        profiles={profiles ?? []}
        errorMessage={errorMessage}
        schemaError={Boolean(schemaError)}
        auditLog={(auditLogData ?? []) as AuditLogEntry[]}
        stats={{
          totalUsers: profiles?.length ?? 0,
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