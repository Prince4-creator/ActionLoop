'use client';

import { useRef } from 'react';
import { toast } from 'sonner';

/**
 * Client-side "undo" pattern for destructive actions: delays the actual
 * network call for a grace period and shows a toast with an Undo button.
 * If the person clicks Undo (or the toast/component unmounts) in time, the
 * delete never happens.
 *
 * This needs NO schema changes — it works by delaying when the existing
 * delete API route is called, not by soft-deleting server-side. That means
 * it can't protect against someone else deleting the same row in that
 * window, but for a single-owner action like "delete this meeting" from
 * meeting-detail-client.tsx, that's an acceptable tradeoff for zero migration
 * work. For a fully server-safe version, add a `deleted_at` column + a
 * restore endpoint instead and I can wire that up.
 *
 * Usage (replaces handleDeleteMeeting in meeting-detail-client.tsx):
 *
 *   const { runWithUndo } = useUndoableDelete();
 *   const handleDeleteMeeting = () => {
 *     if (!confirm('Delete this meeting and all its action items?')) return;
 *     runWithUndo({
 *       label: 'Meeting deleted',
 *       delayMs: 6000,
 *       onCommit: async () => {
 *         await deleteMeeting(meeting.id);
 *         router.push('/dashboard');
 *       },
 *     });
 *   };
 */

export function useUndoableDelete() {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const runWithUndo = ({
    label,
    delayMs = 5000,
    onCommit,
    onUndo,
  }: {
    label: string;
    delayMs?: number;
    onCommit: () => void | Promise<void>;
    onUndo?: () => void;
  }) => {
    const id = `${label}-${Date.now()}`;
    let undone = false;

    const timer = setTimeout(() => {
      if (!undone) {
        void onCommit();
      }
      timers.current.delete(id);
    }, delayMs);

    timers.current.set(id, timer);

    toast(label, {
      duration: delayMs,
      action: {
        label: 'Undo',
        onClick: () => {
          undone = true;
          const pending = timers.current.get(id);
          if (pending) {
            clearTimeout(pending);
            timers.current.delete(id);
          }
          onUndo?.();
          toast.success('Undone');
        },
      },
    });
  };

  return { runWithUndo };
}