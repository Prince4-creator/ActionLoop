import type { SupabaseClient } from '@supabase/supabase-js';

const ZOMBIE_THRESHOLD = 3; // recurrences before flagging as a "zombie task"
const SIMILARITY_MIN = 0.35; // matches the threshold baked into the SQL function too

export type NewActionItemForLinking = {
  id: string;
  description: string;
  assignee_email: string | null;
};

/**
 * Call this right after inserting a batch of new action_items for a meeting
 * (in createMeetingAndExtractActions, after the action_items insert resolves).
 *
 * For each new item, looks for an existing OPEN (non-done) item for the same
 * assignee in the same team with a similar description. If found, chains it
 * as a recurrence and flags items that keep reappearing without ever getting
 * done ("zombie tasks").
 */
export async function linkRecurringActionItems(
  client: SupabaseClient,
  teamId: string | null,
  newItems: NewActionItemForLinking[]
) {
  if (!teamId || !newItems.length) return;

  for (const item of newItems) {
    const assignee = item.assignee_email?.trim();
    if (!assignee || !item.description?.trim()) continue;

    const { data: matches, error } = await client.rpc('find_similar_open_action_item', {
      p_team_id: teamId,
      p_assignee_email: assignee,
      p_description: item.description,
      p_exclude_id: item.id,
    });

    if (error) {
      console.error('[zombie-detection] similarity lookup failed', error);
      continue;
    }

    const best = Array.isArray(matches) ? matches[0] : matches;
    if (!best || best.similarity < SIMILARITY_MIN) continue;

    const nextCount = (best.recurrence_count ?? 0) + 1;

    const { error: updateError } = await client
      .from('action_items')
      .update({
        previous_occurrence_id: best.id,
        recurrence_count: nextCount,
        is_zombie: nextCount >= ZOMBIE_THRESHOLD,
      })
      .eq('id', item.id);

    if (updateError) {
      console.error('[zombie-detection] failed to link recurrence', updateError);
    }
  }
}