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

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, role, updated_at')
    .order('email');

  const { count: meetingRequestsCount, error: meetingRequestsError } = await client
    .from('meeting_requests')
    .select('id', { count: 'exact', head: true });

  const { count: teamsCount } = await client
    .from('teams')
    .select('id', { count: 'exact', head: true });

  const { count: meetingsCount } = await client
    .from('meetings')
    .select('id', { count: 'exact', head: true });

  const { count: actionItemsCount } = await client
    .from('action_items')
    .select('id', { count: 'exact', head: true });

  const { count: pendingActionItemsCount } = await client
    .from('action_items')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'overdue']);

  const { data: auditLogData } = await client
    .from('admin_audit_log')
    .select('id, actor_email, action, target_type, target_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

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