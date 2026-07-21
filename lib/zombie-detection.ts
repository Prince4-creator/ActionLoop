import type { SupabaseClient } from '@supabase/supabase-js';

const ZOMBIE_THRESHOLD = 3; // recurrence_count >= this marks is_zombie
const SIMILARITY_THRESHOLD = 0.6;

function normalizeWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * For each newly created action item, look for an open, unfinished item
 * assigned to the same person on the same team whose description is similar
 * enough to be "the same ask resurfacing." If found, chain the new item to
 * it via previous_occurrence_id and bump recurrence_count. Once an ask has
 * recurred 3+ times without being completed, flag it is_zombie so the UI can
 * surface "this keeps coming back and nobody's closing it."
 */
export async function linkRecurringActionItems(
  client: SupabaseClient,
  teamId: string,
  newItems: Array<{ id: string; description: string; assignee_email: string | null }>
) {
  for (const newItem of newItems) {
    if (!newItem.assignee_email || newItem.assignee_email === 'unassigned@example.com') {
      continue;
    }

    try {
      const { data: candidates, error } = await client
        .from('action_items')
        .select('id, description, recurrence_count, meetings!inner(team_id)')
        .eq('assignee_email', newItem.assignee_email)
        .neq('status', 'done')
        .neq('id', newItem.id)
        .eq('meetings.team_id', teamId);

      if (error || !candidates?.length) continue;

      const newWords = normalizeWords(newItem.description);
      let bestMatch: { id: string; recurrence_count: number | null } | null = null;
      let bestScore = 0;

      for (const candidate of candidates as any[]) {
        const score = jaccardSimilarity(newWords, normalizeWords(candidate.description));
        if (score >= SIMILARITY_THRESHOLD && score > bestScore) {
          bestScore = score;
          bestMatch = { id: candidate.id, recurrence_count: candidate.recurrence_count };
        }
      }

      if (bestMatch) {
        const nextCount = (bestMatch.recurrence_count ?? 1) + 1;
        await client
          .from('action_items')
          .update({
            previous_occurrence_id: bestMatch.id,
            recurrence_count: nextCount,
            is_zombie: nextCount >= ZOMBIE_THRESHOLD,
          })
          .eq('id', newItem.id);
      }
    } catch (err) {
      console.error('[linkRecurringActionItems] failed for item', newItem.id, err);
    }
  }
}