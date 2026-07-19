'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const BUCKET = 'meeting-attachments';

async function assertMeetingAccess(client: any, meetingId: string, userId: string, userEmail: string | null) {
  const { data: meeting, error } = await client
    .from('meetings')
    .select('id, user_id, team_id')
    .eq('id', meetingId)
    .maybeSingle();

  if (error || !meeting) {
    throw new Error('Meeting not found');
  }

  if (meeting.user_id === userId) return meeting;

  if (meeting.team_id) {
    const { data: membership } = await client
      .from('team_members')
      .select('id')
      .eq('team_id', meeting.team_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (membership) return meeting;
  }

  if (userEmail) {
    const { data: shared } = await client
      .from('meeting_members')
      .select('id')
      .eq('meeting_id', meetingId)
      .ilike('email', userEmail)
      .maybeSingle();
    if (shared) return meeting;
  }

  throw new Error('You do not have access to this meeting');
}

export async function uploadMeetingAttachment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const meetingId = String(formData.get('meeting_id') ?? '').trim();
  const file = formData.get('file') as File | null;

  if (!meetingId) throw new Error('meeting_id is required');
  if (!file) throw new Error('No file provided');
  if (file.size > MAX_FILE_SIZE) throw new Error('File is too large (max 25MB)');

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  await assertMeetingAccess(client, meetingId, user.id, user.email ?? null);

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${meetingId}/${Date.now()}-${safeFileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await client.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: record, error: dbError } = await client
    .from('meeting_attachments')
    .insert({
      meeting_id: meetingId,
      uploaded_by: user.id,
      file_name: file.name,
      file_path: storagePath,
      file_size: file.size,
      content_type: file.type || null,
    })
    .select()
    .single();

  if (dbError) {
    // Best-effort cleanup of the orphaned storage object if the DB insert failed.
    await client.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    throw new Error(`Failed to save attachment record: ${dbError.message}`);
  }

  revalidatePath(`/meetings/${meetingId}`);

  return { success: true, attachment: record };
}

export async function getMeetingAttachments(meetingId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  await assertMeetingAccess(client, meetingId, user.id, user.email ?? null);

  const { data, error } = await client
    .from('meeting_attachments')
    .select('id, file_name, file_path, file_size, content_type, uploaded_by, created_at')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load attachments: ${error.message}`);
  }

  return data ?? [];
}

export async function getAttachmentDownloadUrl(attachmentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: attachment, error } = await client
    .from('meeting_attachments')
    .select('id, meeting_id, file_path, file_name')
    .eq('id', attachmentId)
    .maybeSingle();

  if (error || !attachment) {
    throw new Error('Attachment not found');
  }

  await assertMeetingAccess(client, attachment.meeting_id, user.id, user.email ?? null);

  const { data: signed, error: signError } = await client.storage
    .from(BUCKET)
    .createSignedUrl(attachment.file_path, 60 * 5); // 5 minute link

  if (signError || !signed) {
    throw new Error(signError?.message || 'Unable to generate download link');
  }

  return { url: signed.signedUrl, fileName: attachment.file_name };
}

export async function deleteMeetingAttachment(attachmentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: attachment, error } = await client
    .from('meeting_attachments')
    .select('id, meeting_id, file_path, uploaded_by')
    .eq('id', attachmentId)
    .maybeSingle();

  if (error || !attachment) {
    throw new Error('Attachment not found');
  }

  const meeting = await assertMeetingAccess(client, attachment.meeting_id, user.id, user.email ?? null);

  const canDelete = attachment.uploaded_by === user.id || meeting.user_id === user.id;
  if (!canDelete) {
    throw new Error('You can only delete your own uploads');
  }

  await client.storage.from(BUCKET).remove([attachment.file_path]).catch(() => {});

  const { error: deleteError } = await client
    .from('meeting_attachments')
    .delete()
    .eq('id', attachmentId);

  if (deleteError) {
    throw new Error(`Failed to delete attachment: ${deleteError.message}`);
  }

  revalidatePath(`/meetings/${attachment.meeting_id}`);

  return { success: true };
}