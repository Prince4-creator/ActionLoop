import type { SupabaseClient } from '@supabase/supabase-js';

export type AuditLogEntry = {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export async function logAdminAction(
  client: SupabaseClient,
  params: {
    actorId: string;
    actorEmail?: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    details?: Record<string, unknown>;
  }
) {
  try {
    const { error } = await client.from('admin_audit_log').insert({
      actor_id: params.actorId,
      actor_email: params.actorEmail ?? null,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      details: params.details ?? null,
    });

    if (error) {
      console.error('[audit] insert failed', error.message);
    }
  } catch (err) {
    // Never let audit logging break the underlying admin action.
    console.error('[audit] logAdminAction threw', err);
  }
}

export function describeAuditAction(entry: AuditLogEntry): string {
  switch (entry.action) {
    case 'grant_admin_role':
      return `Granted admin to ${entry.target_id}`;
    case 'revoke_admin_role':
      return `Revoked admin from ${entry.target_id}`;
    case 'meeting_request_converted':
      return `Converted meeting request ${entry.target_id} to a meeting`;
    case 'meeting_request_deleted':
      return `Deleted meeting request ${entry.target_id}`;
    default:
      return entry.action.replace(/_/g, ' ');
  }
}