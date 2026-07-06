// Module used by API routes — keep as a regular server module (no 'use server')

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { isAdminUser } from '@/lib/auth';
import { getTeamIdForUser, getTeamMembersWithEmails } from '@/lib/teams';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mistral } from '@mistralai/mistralai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const mistralApiKey = process.env.MISTRAL_API_KEY ? process.env.MISTRAL_API_KEY : null;
const mistralModel = process.env.MISTRAL_MODEL?.trim() || 'mistral-small-latest';
const mistral = mistralApiKey ? new Mistral({ apiKey: mistralApiKey }) : null;

const actionItemSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    description: { type: 'string' },
    assignee_email: { type: 'string' },
    due_date: { type: ['string', 'null'] },
  },
  required: ['description', 'assignee_email', 'due_date'],
} as const;

const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    desired_outcome: { type: ['string', 'null'] },
    decision: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
    action_items: {
      type: 'array',
      items: actionItemSchema,
    },
  },
  required: ['title', 'summary', 'action_items'],
} as const;

interface ActionItem {
  description: string;
  assignee_email: string;
  due_date: string | null;
}

interface ExtractedMeeting {
  title: string;
  summary: string;
  desired_outcome?: string | null;
  decision?: string | null;
  notes?: string | null;
  action_items: ActionItem[];
}

const EXTRACTION_INSTRUCTIONS = `Analyze the meeting transcript and extract:
- A concise meeting title (if none, generate one).
- A summary (1-3 sentences).
- The desired outcome of the meeting.
- The decision made during the meeting.
- Notes: any side comments, caveats, context, blockers, or FYIs mentioned that are NOT a decision and NOT an action item someone is assigned to do (for example: "this depends on legal sign-off", "budget numbers are still pending finance", "this is a tentative date"). Use null if there is nothing that fits this.
- Action items with description, assignee email (from context, or "unassigned@example.com" if unclear), and due date (YYYY-MM-DD format if mentioned, otherwise null).`;

function parseExtractedMeeting(rawText: string): ExtractedMeeting {
  const cleanText = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(cleanText) as Partial<ExtractedMeeting>;

  if (
    typeof parsed.title !== 'string' ||
    typeof parsed.summary !== 'string' ||
    !Array.isArray(parsed.action_items)
  ) {
    throw new Error('AI response missing required fields. Try again.');
  }

  const rawItems: any[] = Array.isArray(parsed.action_items)
    ? parsed.action_items
    : Array.isArray((parsed as any).actionItems)
    ? (parsed as any).actionItems
    : [];

  const actionItems = rawItems.map((item: any) => {
    if (!item || typeof item !== 'object') {
      throw new Error('AI response included an invalid action item. Try again.');
    }

    const description =
      typeof (item as any).description === 'string'
        ? (item as any).description
        : typeof (item as any).description_text === 'string'
        ? (item as any).description_text
        : '';

    if (!description.trim()) {
      throw new Error('AI response included an invalid action item description. Try again.');
    }

    const assigneeEmail =
      typeof (item as any).assignee_email === 'string' && (item as any).assignee_email.trim()
        ? (item as any).assignee_email
        : typeof (item as any).assigneeEmail === 'string' && (item as any).assigneeEmail.trim()
        ? (item as any).assigneeEmail
        : (() => {
            const speakerMatch = description.match(/^([A-Z][a-z]+):/);
            if (speakerMatch) return `${speakerMatch[1].toLowerCase()}@example.com`;
            const inlineMatch = description.match(/\b([A-Z][a-z]+)\b(?=\s+(?:will|can|should|needs|plans|plans to|to|will prepare|will review|will send|will own))/);
            return inlineMatch ? `${inlineMatch[1].toLowerCase()}@example.com` : 'unassigned@example.com';
          })();

    const dueDateRaw =
      typeof (item as any).due_date === 'string'
        ? (item as any).due_date
        : typeof (item as any).dueDate === 'string'
        ? (item as any).dueDate
        : null;

    return {
      description,
      assignee_email: assigneeEmail,
      due_date: typeof dueDateRaw === 'string' && dueDateRaw.trim() ? dueDateRaw.trim() : null,
    };
  });

  return {
    title: parsed.title,
    summary: parsed.summary,
    desired_outcome:
      typeof parsed.desired_outcome === 'string'
        ? parsed.desired_outcome
        : typeof (parsed as any).desiredOutcome === 'string'
        ? (parsed as any).desiredOutcome
        : typeof (parsed as any).outcome === 'string'
        ? (parsed as any).outcome
        : null,
    decision:
      typeof parsed.decision === 'string'
        ? parsed.decision
        : typeof (parsed as any).decision_made === 'string'
        ? (parsed as any).decision_made
        : typeof (parsed as any).decisionMade === 'string'
        ? (parsed as any).decisionMade
        : null,
    notes:
      typeof parsed.notes === 'string'
        ? parsed.notes
        : typeof (parsed as any).side_notes === 'string'
        ? (parsed as any).side_notes
        : typeof (parsed as any).additional_notes === 'string'
        ? (parsed as any).additional_notes
        : null,
    action_items: actionItems,
  };
}

function normalizeMistralContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((chunk) => {
        if (typeof chunk === 'string') {
          return chunk;
        }

        if (chunk && typeof chunk === 'object' && typeof (chunk as any).text === 'string') {
          return (chunk as any).text;
        }

        return '';
      })
      .join('');
  }

  return '';
}

function getMistralResponseText(response: any): string {
  const choice = response?.choices?.[0];
  if (!choice) {
    throw new Error('Mistral returned no completion choices.');
  }

  if (choice.message?.content !== undefined && choice.message?.content !== null) {
    const text = normalizeMistralContent(choice.message.content);
    if (text.trim()) {
      return text;
    }
  }

  if (Array.isArray(choice.messages)) {
    const text = choice.messages
      .map((message: any) => normalizeMistralContent(message?.content))
      .join('');
    if (text.trim()) {
      return text;
    }
  }

  throw new Error('Mistral returned an empty response.');
}

async function extractWithMistral(transcript: string): Promise<ExtractedMeeting> {
  if (!mistral) {
    throw new Error('Mistral is not configured.');
  }

  console.log('[extractWithMistral] using model', mistralModel);

  const response = await mistral.chat.complete({
    model: mistralModel,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'Extract meeting metadata from transcripts. Return only valid JSON that matches the provided schema.',
      },
      {
        role: 'user',
        content: `${EXTRACTION_INSTRUCTIONS}\n\nTranscript:\n${transcript}`,
      },
    ],
    responseFormat: {
      type: 'json_schema' as const,
      jsonSchema: {
        name: 'meeting_extraction',
        description: 'Meeting extraction schema',
        schemaDefinition: extractionSchema,
        strict: true,
      },
    },
  });

  const rawText = getMistralResponseText(response);
  return parseExtractedMeeting(rawText);
}

function extractLocally(transcript: string): ExtractedMeeting {
  console.warn('[extractLocally] falling back to local (non-AI) extraction — check AI provider logs above');

  const sentences = transcript
    .split(/[\.\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const titleGuess = sentences.length ? sentences[0].slice(0, 80) : 'Untitled Meeting';
  const summaryGuess = sentences.slice(0, 2).join('. ').slice(0, 300);

  const lines = transcript.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const action_items: ActionItem[] = [];

  for (const line of lines) {
    const speakerMatch = line.match(/^([A-Z][a-z]+):\s*(.+)$/);
    if (speakerMatch) {
      const name = speakerMatch[1];
      const body = speakerMatch[2];
      if (/\b(will|can|should|needs|plans?|must|to\s+|by\s+\d{4}-\d{2}-\d{2})\b/i.test(body)) {
        action_items.push({
          description: `${name}: ${body}`,
          assignee_email: `${name.toLowerCase()}@example.com`,
          due_date: null,
        });
        continue;
      }
    }

    if (/\b(?:will|can|should|needs|plans?|must|due by|by\s+\d{4}-\d{2}-\d{2})\b/i.test(line)) {
      const m = line.match(/^([A-Z][a-z]+)\b/);
      const name = m ? m[1] : null;
      const email = name ? `${name.toLowerCase()}@example.com` : 'unassigned@example.com';
      action_items.push({ description: line, assignee_email: email, due_date: null });
    }
  }

  if (!action_items.length) {
    action_items.push({
      description: sentences.slice(0, 2).join('. '),
      assignee_email: 'unassigned@example.com',
      due_date: null,
    });
  }

  const desiredOutcomeMatch = transcript.match(/desired outcome\s*[:\-]\s*([^\n]+)/i);
  const decisionMatch = transcript.match(/decision\s*[:\-]\s*([^\n]+)/i);
  // Local fallback can only reliably catch notes that are explicitly labeled
  // in the transcript — it has no way to infer implicit "side comments".
  const notesMatch = transcript.match(/notes?\s*[:\-]\s*([^\n]+)/i);

  return {
    title: titleGuess,
    summary: summaryGuess,
    desired_outcome: desiredOutcomeMatch ? desiredOutcomeMatch[1].trim() : null,
    decision: decisionMatch ? decisionMatch[1].trim() : null,
    notes: notesMatch ? notesMatch[1].trim() : null,
    action_items,
  };
}

async function extractWithAnyAI(transcript: string): Promise<ExtractedMeeting> {
  const providers = [
    { name: 'Mistral', fn: extractWithMistral, available: Boolean(mistral) },
    { name: 'Gemini', fn: extractWithGemini, available: Boolean(genAI) },
    { name: 'OpenAI', fn: extractWithOpenAI, available: Boolean(openai) },
  ];

  const errors: string[] = [];
  for (const provider of providers) {
    if (!provider.available) {
      console.warn(`[extractWithAnyAI] ${provider.name} not configured (missing API key) — skipping`);
      continue;
    }

    try {
      console.log(`[extractWithAnyAI] attempting extraction with ${provider.name}`);
      const result = await provider.fn(transcript);
      console.log(`[extractWithAnyAI] ${provider.name} succeeded`);
      return result;
    } catch (err) {
      const message = `${provider.name} failed: ${String((err as Error)?.message ?? err)}`;
      console.error('[extractWithAnyAI]', message, err);
      errors.push(message);
    }
  }

  console.error(
    '[extractWithAnyAI] All AI providers unavailable or failed — using local (non-AI) fallback extractor.',
    errors.length ? errors : 'No providers were configured at all (check MISTRAL_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY).'
  );

  return extractLocally(transcript);
}

async function extractWithOpenAI(transcript: string): Promise<ExtractedMeeting> {
  if (!openai) {
    throw new Error('OpenAI is not configured.');
  }

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    input: [
      {
        role: 'system',
        content:
          'Extract meeting metadata from transcripts. Return only valid JSON that matches the provided schema.',
      },
      {
        role: 'user',
        content: `${EXTRACTION_INSTRUCTIONS}\n\nTranscript:\n${transcript}`,
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'meeting_extraction',
        schema: extractionSchema,
        strict: true,
      },
    },
    temperature: 0.2,
  });

  if (!response.output_text) {
    throw new Error('OpenAI returned an empty response. Please try again.');
  }

  return parseExtractedMeeting(response.output_text);
}

async function extractWithGemini(transcript: string): Promise<ExtractedMeeting> {
  if (!genAI) {
    throw new Error('No AI provider is configured.');
  }

  const configuredGeminiModel = process.env.GEMINI_MODEL?.trim();
  const modelName =
    configuredGeminiModel && configuredGeminiModel.toLowerCase() !== 'current'
      ? configuredGeminiModel
      : 'gemini-2.5-flash';

  const prompt = `Analyze the meeting transcript and return ONLY a valid JSON object (no markdown, no extra text) with this exact structure:
{
  "title": "generated meeting title",
  "summary": "1-3 sentence summary",
  "desired_outcome": "meeting desired outcome or null",
  "decision": "meeting decision or null",
  "notes": "side comments, caveats, blockers, or FYIs that are not a decision or action item, or null",
  "action_items": [
    {
      "description": "task description",
      "assignee_email": "person@example.com",
      "due_date": "YYYY-MM-DD or null"
    }
  ]
}

${EXTRACTION_INSTRUCTIONS}

Transcript:
${transcript}`;

  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.3,
      },
    });

    const result = await model.generateContent(prompt);
    return parseExtractedMeeting(result.response.text());
  } catch (err) {
    const message = String((err as Error)?.message ?? err ?? 'Unknown error');
    throw new Error(`Gemini request failed: ${message}.`);
  }
}

function resolveAssigneeEmail(
  rawEmail: string,
  description: string,
  teamMembers: Array<{ email: string | null }>
): string {
  // If AI already gave a real, non-fabricated email, keep it
  if (rawEmail && !rawEmail.toLowerCase().endsWith('@example.com')) {
    return rawEmail;
  }

  // Try to match the speaker name in the description to a real team member's email
  const speakerMatch = description.match(/^([A-Z][a-z]+):/);
  const nameGuess = speakerMatch?.[1]?.toLowerCase();

  if (nameGuess) {
    const match = teamMembers.find((member) =>
      member.email?.toLowerCase().startsWith(nameGuess)
    );
    if (match?.email) return match.email;
  }

  return rawEmail || 'unassigned@example.com';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return (
      String(record.message ?? '') ||
      String(record.details ?? '') ||
      String(record.hint ?? '') ||
      String(record.code ?? '') ||
      JSON.stringify(record)
    );
  }

  return String(error ?? 'Unknown error');
}

// Recompute a meeting's outcome_score from its action items' completion rate.
// Called whenever an action item's status changes.
async function recalculateOutcomeScore(client: any, meetingId: string) {
  const { data: items, error } = await client
    .from('action_items')
    .select('status')
    .eq('meeting_id', meetingId);

  if (error) {
    console.error('[recalculateOutcomeScore] failed to load action items', error);
    return null;
  }

  if (!items || !items.length) {
    return null;
  }

  const done = items.filter((item: { status: string }) => item.status === 'done').length;
  const score = Math.round((done / items.length) * 100);

  const { error: updateError } = await client
    .from('meetings')
    .update({ outcome_score: score })
    .eq('id', meetingId);

  if (updateError) {
    console.error('[recalculateOutcomeScore] failed to update meeting outcome_score', updateError);
    return null;
  }

  return score;
}

export async function createMeetingAndExtractActions(formData: FormData) {
  const supabase = await createClient();
  let user = null as any;
  try {
    const res = await supabase.auth.getUser();
    user = res.data.user;
  } catch (err) {
    // ignore - we'll fallback to admin client if available
    user = null;
  }

  const adminClient = createAdminClient();
  const writeClient = adminClient ?? supabase;

  // If there's no authenticated user and no admin client, require auth
  if (!user && !adminClient) {
    throw new Error('Not authenticated');
  }

  // If we have a user but they're not an admin, disallow creating meetings
  if (user && !isAdminUser(user) && !adminClient) {
    throw new Error('Only admins can create meetings. Please request one from your workspace admin.');
  }

  const title = formData.get('title') as string;
  const desiredOutcome = formData.get('desired_outcome') as string;
  const notes = formData.get('notes') as string;
  const transcript = formData.get('transcript') as string;
  const teamId = user ? await getTeamIdForUser(supabase, user.id, user.email) : null;
  const teamMembers = teamId ? await getTeamMembersWithEmails(writeClient, teamId) : [];

  if (!transcript) {
    throw new Error('Transcript is required');
  }

  const output = await extractWithAnyAI(transcript);

  if (!output.title || !output.summary || !Array.isArray(output.action_items)) {
    throw new Error('AI response missing required fields. Try again.');
  }

  // Manual "Notes" field (if the user typed one) always wins over the AI's
  // inferred notes — the AI-extracted notes are only used as a fallback when
  // the user left the field blank.
  const resolvedNotes = notes?.trim()
    ? notes.trim()
    : typeof output.notes === 'string' && output.notes.trim()
    ? output.notes.trim()
    : null;

  const meetingPayload = {
    ...(user ? { user_id: user.id } : {}),
    ...(teamId ? { team_id: teamId } : {}),
    title: output.title || title || 'Untitled Meeting',
    transcript,
    summary: output.summary,
    outcome_score: 0,
    ...(resolvedNotes ? { notes: resolvedNotes } : {}),
    ...(desiredOutcome?.trim()
      ? { desired_outcome: desiredOutcome.trim() }
      : typeof output.desired_outcome === 'string' && output.desired_outcome.trim()
      ? { desired_outcome: output.desired_outcome.trim() }
      : {}),
    ...(typeof output.decision === 'string' && output.decision.trim() ? { decision: output.decision.trim() } : {}),
  };

  const stripMissingColumns = (payload: Record<string, unknown>, message?: string) => {
    if (!message) return payload;
    const lower = String(message).toLowerCase();

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

    if (missingCols.length === 0) return payload;

    console.error(
      `[createMeetingAndExtractActions] Database is missing column(s): ${missingCols.join(', ')}. ` +
        `These fields will NOT be saved until you apply the relevant migration ` +
        `(e.g. supabase/migrations/20260702160000_meeting_outcomes.sql or 20260704120000_add_meeting_notes.sql).`
    );

    const result = { ...payload };
    for (const col of missingCols) {
      if (Object.prototype.hasOwnProperty.call(result, col)) {
        delete result[col];
      }
    }
    return result;
  };

  let meeting: { id: string } | null = null;
  let { data, error: meetingError } = await writeClient
    .from('meetings')
    .insert(meetingPayload)
    .select('id')
    .single();
  meeting = data as { id: string } | null;

  if (meetingError) {
    console.error('[meetings] create meeting error', meetingError);
    const strippedPayload = stripMissingColumns(meetingPayload, meetingError.message);
    if (strippedPayload !== meetingPayload) {
      const retry = await writeClient
        .from('meetings')
        .insert(strippedPayload)
        .select('id')
        .single();
      meeting = retry.data as { id: string } | null;
      meetingError = retry.error;
    }
  }

  if (meetingError && teamId) {
    const { data: fallbackMeeting, error: fallbackMeetingError } = await writeClient
      .from('meetings')
      .insert({
        ...(user ? { user_id: user.id } : {}),
        title: output.title || title || 'Untitled Meeting',
        transcript,
        summary: output.summary,
      })
      .select('id')
      .single();

    if (fallbackMeetingError) {
      console.error('[meetings] fallback create meeting error', fallbackMeetingError);
      throw new Error(
        'Meeting insert failed: ' +
          (fallbackMeetingError.message ?? JSON.stringify(fallbackMeetingError))
      );
    }
    meeting = fallbackMeeting as { id: string } | null;
  } else if (meetingError) {
    throw new Error(
      'Meeting insert failed: ' +
        (meetingError.message ?? JSON.stringify(meetingError))
    );
  }

  if (!meeting?.id) {
    throw new Error('Failed to create meeting');
  }

  const actionItems = output.action_items.map((item: ActionItem) => ({
    meeting_id: meeting.id,
    assignee_email: resolveAssigneeEmail(item.assignee_email, item.description, teamMembers),
    description: item.description,
    due_date: item.due_date ? item.due_date : null,
    status: 'pending',
  }));

  const { error: itemsError } = await writeClient
    .from('action_items')
    .insert(actionItems);

  if (itemsError) {
    console.error('[meetings] insert action_items error', itemsError);
  }

  if (itemsError && teamId) {
    const { error: fallbackItemsError } = await writeClient
      .from('action_items')
      .insert(
        output.action_items.map((item: ActionItem) => ({
          meeting_id: meeting.id,
          assignee_email: resolveAssigneeEmail(item.assignee_email, item.description, teamMembers),
          description: item.description,
          due_date: item.due_date || null,
          status: 'pending',
        }))
      );

    if (fallbackItemsError) {
      console.error('[meetings] fallback insert action_items error', fallbackItemsError);
      throw new Error(
        'Action items insert failed: ' +
          (fallbackItemsError.message ?? JSON.stringify(fallbackItemsError))
      );
    }
  } else if (itemsError) {
    throw new Error(
      'Action items insert failed: ' +
        (itemsError.message ?? JSON.stringify(itemsError))
    );
  }

  // Initialize outcome_score at 0% (no items done yet) now that items exist.
  await recalculateOutcomeScore(writeClient, meeting.id);

  return meeting.id;
}

export async function markActionItemDone(actionItemId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: item, error: itemError } = await client
    .from('action_items')
    .select('id, meeting_id')
    .eq('id', actionItemId)
    .maybeSingle();

  if (itemError) throw itemError;

  const { error } = await client.from('action_items').update({ status: 'done' }).eq('id', actionItemId);

  if (error) throw error;

  if (item?.meeting_id) {
    // Recalculate the meeting's follow-through / outcome score based on the
    // new completion ratio of its action items.
    await recalculateOutcomeScore(client, item.meeting_id);

    const { data: meeting } = await client.from('meetings').select('id, title, team_id').eq('id', item.meeting_id).maybeSingle();
    if (meeting?.team_id) {
      const { data: remainingItems } = await client
        .from('action_items')
        .select('id')
        .eq('meeting_id', item.meeting_id)
        .neq('status', 'done');

      if (!remainingItems?.length) {
        revalidatePath('/team');
        return { completedMeeting: meeting };
      }
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/meetings');
  revalidatePath('/meetings/[id]');

  return { success: true, completedMeeting: null };
}

export async function shareMeetingWithUser(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;
  const meetingId = String(formData.get('meeting_id') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!meetingId || !email) {
    throw new Error('Meeting id and email are required');
  }

  const { data: meeting, error: meetingError } = await client
    .from('meetings')
    .select('id, user_id')
    .eq('id', meetingId)
    .maybeSingle();

  if (meetingError || !meeting) {
    throw new Error('Meeting not found');
  }

  if (meeting.user_id !== user.id && !isAdminUser(user)) {
    throw new Error('You do not have permission to share this meeting');
  }

  const { error } = await client
    .from('meeting_members')
    .upsert(
      {
        meeting_id: meetingId,
        email,
        created_by: user.id,
      },
      { onConflict: 'meeting_id,email' }
    );

  if (error) {
    throw error;
  }

  return { success: true };
}