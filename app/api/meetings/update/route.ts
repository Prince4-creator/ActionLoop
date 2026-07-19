import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { revalidatePath } from 'next/cache';
import { isAdminUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      try {
        const form = await req.formData();
        body = Object.fromEntries(form.entries());
      } catch {
        body = {};
      }
    }

    const meetingId = String(body.meetingId ?? body.id ?? '').trim();
    const title = typeof body.title === 'string' ? body.title.trim() : null;
    const summary = typeof body.summary === 'string' ? body.summary.trim() : null;
    const desiredOutcome = typeof body.desired_outcome === 'string'
      ? body.desired_outcome.trim()
      : typeof body.desiredOutcome === 'string'
      ? body.desiredOutcome.trim()
      : null;
    const decision = typeof body.decision === 'string' ? body.decision.trim() : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;

    let outcomeScore: number | null = null;
    if (Object.prototype.hasOwnProperty.call(body, 'outcome_score') || Object.prototype.hasOwnProperty.call(body, 'outcomeScore')) {
      const rawScore = String(body.outcome_score ?? body.outcomeScore ?? '').trim();
      if (rawScore !== '') {
        const parsedScore = Number(rawScore);
        if (Number.isNaN(parsedScore)) {
          return NextResponse.json({ error: 'Invalid outcome score' }, { status: 400 });
        }
        outcomeScore = Math.max(0, Math.min(100, Math.round(parsedScore)));
      } else {
        outcomeScore = 0;
      }
    }

    let attendeeCount: number | null = null;
    if (Object.prototype.hasOwnProperty.call(body, 'attendee_count') || Object.prototype.hasOwnProperty.call(body, 'attendeeCount')) {
      const rawCount = String(body.attendee_count ?? body.attendeeCount ?? '').trim();
      if (rawCount !== '') {
        const parsedCount = Number(rawCount);
        if (Number.isNaN(parsedCount)) {
          return NextResponse.json({ error: 'Invalid attendee count' }, { status: 400 });
        }
        attendeeCount = Math.max(1, Math.round(parsedCount));
      } else {
        attendeeCount = 1;
      }
    }

    let avgHourlyRate: number | null = null;
    if (Object.prototype.hasOwnProperty.call(body, 'avg_hourly_rate') || Object.prototype.hasOwnProperty.call(body, 'avgHourlyRate')) {
      const rawRate = String(body.avg_hourly_rate ?? body.avgHourlyRate ?? '').trim();
      if (rawRate !== '') {
        const parsedRate = Number(rawRate);
        if (Number.isNaN(parsedRate)) {
          return NextResponse.json({ error: 'Invalid hourly rate' }, { status: 400 });
        }
        avgHourlyRate = Math.max(0, parsedRate);
      } else {
        avgHourlyRate = 0;
      }
    }

    if (!meetingId) return NextResponse.json({ error: 'meetingId is required' }, { status: 400 });

    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const adminClient = createAdminClient();
    const supabase = isAdminUser(user) && adminClient ? adminClient : sessionClient;

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, user_id')
      .eq('id', meetingId)
      .maybeSingle();

    if (meetingError || !meeting) {
      const payload: { error: string; debug?: Record<string, unknown> } = { error: 'Meeting not found' };
      if (process.env.NODE_ENV !== 'production') {
        payload.debug = {
          meetingError: meetingError?.message ?? null,
          meetingId,
          userId: user.id,
          isAdmin: isAdminUser(user),
        };
      }
      return NextResponse.json(payload, { status: 404 });
    }

    const canManage = meeting.user_id === user.id || isAdminUser(user);
    if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const updates: Record<string, unknown> = {};
    if (title !== null) updates.title = title;
    if (summary !== null) updates.summary = summary;
    if (notes !== null) updates.notes = notes;
    if (desiredOutcome !== null) updates.desired_outcome = desiredOutcome;
    if (decision !== null) updates.decision = decision;
    if (outcomeScore !== null) updates.outcome_score = outcomeScore;
    if (attendeeCount !== null) updates.attendee_count = attendeeCount;
    if (avgHourlyRate !== null) updates.avg_hourly_rate = avgHourlyRate;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true });
    }

    let { error: updateError } = await supabase.from('meetings').update(updates).eq('id', meetingId);

    const getMissingCols = (message: string | null | undefined) => {
      const lower = String(message ?? '').toLowerCase();
      const missingCols: string[] = [];

      const colRegex = /column\s+(?:\w+\.)?(\w+)\s+does not exist/gi;
      let m: RegExpExecArray | null;
      while ((m = colRegex.exec(lower)) !== null) {
        if (m[1]) missingCols.push(m[1]);
      }

      const cacheRegex = /could not find the '([^']+)' column of '[^']+' in the schema cache/gi;
      while ((m = cacheRegex.exec(lower)) !== null) {
        if (m[1]) missingCols.push(m[1]);
      }

      return missingCols;
    };

    let droppedColumns: string[] = [];

    // If update failed due to missing columns in the DB schema, strip those keys and retry.
    if (updateError) {
      const missingCols = getMissingCols(updateError.message);
      if (missingCols.length > 0) {
        droppedColumns = missingCols.filter((col) => Object.prototype.hasOwnProperty.call(updates, col));

        for (const col of missingCols) {
          if (Object.prototype.hasOwnProperty.call(updates, col)) {
            delete updates[col];
          }
        }

        if (droppedColumns.length) {
          // This used to fail silently — that's why desired_outcome / decision /
          // outcome_score looked like they "weren't saving". Log it loudly now.
          console.error(
            `[api/meetings/update] Database is missing column(s): ${droppedColumns.join(', ')}. ` +
              `Apply migration supabase/migrations/20260702160000_meeting_outcomes.sql (or ` +
              `supabase/migrations/20260719000000_meeting_cost.sql, or run: ` +
              `select column_name from information_schema.columns where table_name = 'meetings') to fix this.`
          );
        }

        if (Object.keys(updates).length === 0) {
          // Nothing left to update — treat as success
          updateError = null;
        } else {
          const retry = await supabase.from('meetings').update(updates).eq('id', meetingId);
          updateError = retry.error ?? null;
        }
      }
    }

    if (updateError) return NextResponse.json({ error: updateError.message ?? 'Update failed' }, { status: 500 });

    // Revalidate relevant pages
    try {
      revalidatePath('/dashboard');
      revalidatePath('/meetings');
      revalidatePath(`/meetings/${meetingId}`);
    } catch {
      // best-effort revalidation
    }

    if (droppedColumns.length) {
      // Let the client know the save was partial, so the UI can warn the user
      // instead of showing a false "Meeting updated" success toast.
      return NextResponse.json({
        success: true,
        warning: `These fields could not be saved because the database schema is out of date: ${droppedColumns.join(', ')}.`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? 'Unknown error' }, { status: 500 });
  }
}