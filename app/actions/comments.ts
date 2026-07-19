'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/admin';

async function assertActionItemAccess(client: any, actionItemId: string, userId: string, userEmail: string | null) {
  const { data: item, error } = await client
    .from('action_items')
    .select('id, meeting_id')
    .eq('id', actionItemId)
    .maybeSingle();

  if (error || !item) {
    throw new Error('Action item not found');
  }

  const { data: meeting, error: meetingError } = await client
    .from('meetings')
    .select('id, user_id, team_id')
    .eq('id', item.meeting_id)
    .maybeSingle();

  if (meetingError || !meeting) {
    throw new Error('Meeting not found');
  }

  if (meeting.user_id === userId) return item;

  if (meeting.team_id) {
    const { data: membership } = await client
      .from('team_members')
      .select('id')
      .eq('team_id', meeting.team_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (membership) return item;
  }

  if (userEmail) {
    const { data: shared } = await client
      .from('meeting_members')
      .select('id')
      .eq('meeting_id', item.meeting_id)
      .ilike('email', userEmail)
      .maybeSingle();
    if (shared) return item;
  }

  throw new Error('You do not have access to this action item');
}

export async function getActionItemComments(actionItemId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  await assertActionItemAccess(client, actionItemId, user.id, user.email ?? null);

  const { data, error } = await client
    .from('action_item_comments')
    .select('id, body, author_id, author_email, created_at')
    .eq('action_item_id', actionItemId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load comments: ${error.message}`);
  }

  return data ?? [];
}

export async function addActionItemComment(actionItemId: string, body: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    throw new Error('Not authenticated');
  }

  const trimmedBody = body.trim();
  if (!trimmedBody) {
    throw new Error('Comment cannot be empty');
  }
  if (trimmedBody.length > 2000) {
    throw new Error('Comment is too long (max 2000 characters)');
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const item = await assertActionItemAccess(client, actionItemId, user.id, user.email);

  const { data: comment, error } = await client
    .from('action_item_comments')
    .insert({
      action_item_id: actionItemId,
      author_id: user.id,
      author_email: user.email,
      body: trimmedBody,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to post comment: ${error.message}`);
  }

  revalidatePath(`/meetings/${item.meeting_id}`);

  return { success: true, comment };
}

export async function deleteActionItemComment(commentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const adminClient = createAdminClient();
  const client = adminClient ?? supabase;

  const { data: comment, error } = await client
    .from('action_item_comments')
    .select('id, author_id, action_item_id')
    .eq('id', commentId)
    .maybeSingle();

  if (error || !comment) {
    throw new Error('Comment not found');
  }

  if (comment.author_id !== user.id) {
    throw new Error('You can only delete your own comments');
  }

  const { error: deleteError } = await client
    .from('action_item_comments')
    .delete()
    .eq('id', commentId);

  if (deleteError) {
    throw new Error(`Failed to delete comment: ${deleteError.message}`);
  }

  return { success: true };
}