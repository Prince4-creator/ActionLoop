import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/admin';

export type AccountabilityRow = {
  email: string;
  totalJudged: number;
  onTime: number;
  late: number;
  missed: number;
  openNotYetDue: number;
  scorePercent: number | null; // null = not enough judged items yet
};

/**
 * Per-assignee accountability: what % of "judged" action items (done, or
 * overdue-and-still-pending) were actually completed on or before their due
 * date. Items that haven't reached their due date yet are excluded from the
 * denominator — they haven't failed anything, they're just not due.
 */
export async function getTeamAccountability(
  supabase: SupabaseClient,
  teamId: string
): Promise<AccountabilityRow[]> {
  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: meetings, error: meetingsError } = await client
    .from('meetings')
    .select('id')
    .eq('team_id', teamId);

  if (meetingsError) throw meetingsError;
  const meetingIds = (meetings ?? []).map((m) => m.id);
  if (!meetingIds.length) return [];

  const { data: items, error: itemsError } = await client
    .from('action_items')
    .select('assignee_email, status, due_date, completed_at')
    .in('meeting_id', meetingIds);

  if (itemsError) throw itemsError;

  const now = new Date();
  const byEmail = new Map<string, AccountabilityRow>();

  for (const item of items ?? []) {
    const email = item.assignee_email?.trim().toLowerCase();
    if (!email) continue;

    const row =
      byEmail.get(email) ??
      ({
        email,
        totalJudged: 0,
        onTime: 0,
        late: 0,
        missed: 0,
        openNotYetDue: 0,
        scorePercent: null,
      } satisfies AccountabilityRow);

    const due = item.due_date ? new Date(item.due_date) : null;
    const completed = item.completed_at ? new Date(item.completed_at) : null;
    const isDone = item.status === 'done';

    if (isDone) {
      if (!due || (completed && completed <= due)) {
        row.onTime += 1;
      } else {
        row.late += 1;
      }
      row.totalJudged += 1;
    } else if (due && due < now) {
      row.missed += 1;
      row.totalJudged += 1;
    } else {
      row.openNotYetDue += 1;
    }

    byEmail.set(email, row);
  }

  for (const row of byEmail.values()) {
    row.scorePercent = row.totalJudged > 0 ? Math.round((row.onTime / row.totalJudged) * 100) : null;
  }

  return Array.from(byEmail.values()).sort((a, b) => (b.scorePercent ?? -1) - (a.scorePercent ?? -1));
}