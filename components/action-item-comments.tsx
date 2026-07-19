'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { MessageSquare, Send, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { getActionItemComments, addActionItemComment, deleteActionItemComment } from '@/app/actions/comments';

type Comment = {
  id: string;
  body: string;
  author_id: string;
  author_email: string;
  created_at: string;
};

function initialsFor(email: string) {
  const name = email.split('@')[0];
  const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'U';
}

export function ActionItemComments({ actionItemId, currentUserId }: { actionItemId: string; currentUserId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadComments = async () => {
    setIsLoading(true);
    try {
      const data = await getActionItemComments(actionItemId);
      setComments(data as Comment[]);
      setHasLoaded(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load comments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (expanded && !hasLoaded) {
      loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const handlePost = async () => {
    if (!draft.trim()) return;
    setIsPosting(true);
    try {
      const result = await addActionItemComment(actionItemId, draft);
      if (result?.comment) {
        setComments((current) => [...current, result.comment as Comment]);
      }
      setDraft('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to post comment');
    } finally {
      setIsPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteActionItemComment(commentId);
      setComments((current) => current.filter((c) => c.id !== commentId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete comment');
    }
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {comments.length > 0 ? `${comments.length} comment${comments.length === 1 ? '' : 's'}` : 'Add comment'}
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-white/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
          {isLoading ? (
            <p className="text-xs text-slate-400">Loading comments...</p>
          ) : comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {initialsFor(comment.author_email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{comment.author_email}</p>
                      <p className="text-[10px] text-slate-400">{new Date(comment.created_at).toLocaleString()}</p>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{comment.body}</p>
                  </div>
                  {comment.author_id === currentUserId ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      className="shrink-0 text-slate-400 hover:text-red-500"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No comments yet. Be the first to add context.</p>
          )}

          <div className="flex items-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              className="min-h-0 flex-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handlePost();
                }
              }}
            />
            <Button
              size="icon-sm"
              className="rounded-full"
              onClick={handlePost}
              disabled={isPosting || !draft.trim()}
              aria-label="Post comment"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}