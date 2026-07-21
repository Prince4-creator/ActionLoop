import type { SupabaseClient } from '@supabase/supabase-js';

export type PriorOpenItem = {
  description: string;
  assignee_email: string;
  due_date: string | null;
  meeting_id: string;
};

export type AgendaSuggestion = {
  priorMeetingTitle: string;
  priorMeetingDate: string | null;
  openItems: PriorOpenItem[];
  staleDesiredOutcome: string | null;
};

/**
 * Looks for the most recent meeting with a similar title on the same team,
 * and pulls its still-open action items plus its desired_outcome if that
 * outcome was never matched by a later decision. Used to pre-fill an agenda
 * for a recurring meeting before the transcript is even pasted in.
 */
export async function getPriorOpenItems(
  client: SupabaseClient,
  teamId: string,
  title: string
): Promise<AgendaSuggestion | null> {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) return null;

  const { data: priorMeetings, error: meetingsError } = await client
    .from('meetings')
    .select('id, title, desired_outcome, decision, created_at')
    .eq('team_id', teamId)
    .ilike('title', `%${normalizedTitle}%`)
    .order('created_at', { ascending: false })
    .limit(3);

  if (meetingsError || !priorMeetings?.length) return null;

  const mostRecent = priorMeetings[0];
  const meetingIds = priorMeetings.map((m) => m.id);

  const { data: openItems, error: itemsError } = await client
    .from('action_items')
    .select('description, assignee_email, due_date, meeting_id')
    .in('meeting_id', meetingIds)
    .neq('status', 'done')
    .order('due_date', { ascending: true });

  if (itemsError) return null;

  // "Stale" desired outcome: the most recent meeting stated one, but no
  // meeting in this chain ever recorded a matching decision — i.e. it's
  // still an open question worth putting back on the agenda.
  const staleDesiredOutcome =
    mostRecent.desired_outcome && !priorMeetings.some((m) => m.decision?.trim())
      ? mostRecent.desired_outcome
      : null;

  return {
    priorMeetingTitle: mostRecent.title || 'Untitled meeting',
    priorMeetingDate: mostRecent.created_at ?? null,
    openItems: (openItems ?? []) as PriorOpenItem[],
    staleDesiredOutcome,
  };
}

/**
 * Renders the suggestion into plain text suitable for prepending to the
 * meeting's "notes" field, so it flows through the AI extraction naturally
 * instead of living in a separate UI-only silo.
 */
export function formatAgendaAsNotes(suggestion: AgendaSuggestion): string {
  const lines: string[] = [`Agenda carried over from "${suggestion.priorMeetingTitle}":`];

  if (suggestion.staleDesiredOutcome) {
    lines.push(`- Still open: ${suggestion.staleDesiredOutcome}`);
  }

  for (const item of suggestion.openItems) {
    const due = item.due_date ? ` (due ${item.due_date})` : '';
    lines.push(`- Follow up: ${item.description} — ${item.assignee_email}${due}`);
  }

  return lines.join('\n');
}