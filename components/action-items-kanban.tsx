'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Clock3, ChevronRight, ChevronLeft } from 'lucide-react';
import { markActionItemDone } from '@/app/actions/meetings';
import { ZombieTaskBadge } from '@/components/zombie-task-badge';

/**
 * Kanban board for a meeting's action items: Pending / Overdue / Done columns.
 *
 * Usage in app/meetings/[id]/meeting-detail-client.tsx — swap in as an
 * alternative view alongside the existing tab-filtered list:
 *
 *   <ActionItemsKanban
 *     items={actionItems}
 *     onItemUpdated={(id, patch) => setActionItems(current =>
 *       current.map(i => i.id === id ? { ...i, ...patch } : i)
 *     )}
 *     isAdmin={isAdmin}
 *     onSendReminder={handleSendReminder}
 *   />
 *
 * No drag-and-drop library is installed in this repo (no @dnd-kit / react-dnd),
 * so movement between columns is click-to-advance rather than true drag-drop.
 * If you want real drag-and-drop, add @dnd-kit/core and I can wire it in.
 */

type ActionItemRecord = {
  id: string;
  description: string;
  assignee_email: string;
  due_date: string | null;
  status: string;
  recurrence_count?: number | null;
};

const COLUMNS = [
  { key: 'pending', label: 'Pending', icon: Circle, accent: 'bg-amber-100 text-amber-800' },
  { key: 'overdue', label: 'Overdue', icon: Clock3, accent: 'bg-red-100 text-red-800' },
  { key: 'done', label: 'Done', icon: CheckCircle2, accent: 'bg-emerald-100 text-emerald-800' },
] as const;

export function ActionItemsKanban({
  items,
  onItemUpdated,
  isAdmin,
  onSendReminder,
}: {
  items: ActionItemRecord[];
  onItemUpdated: (id: string, patch: Partial<ActionItemRecord>) => void;
  isAdmin?: boolean;
  onSendReminder?: (itemId: string) => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, ActionItemRecord[]> = { pending: [], overdue: [], done: [] };
    for (const item of items) {
      const key = map[item.status] ? item.status : 'pending';
      map[key].push(item);
    }
    return map;
  }, [items]);

  const handleAdvance = async (item: ActionItemRecord) => {
    if (item.status === 'done') return;
    setPendingId(item.id);
    const previousStatus = item.status;
    onItemUpdated(item.id, { status: 'done' });
    try {
      await markActionItemDone(item.id);
      toast.success('Marked as done');
    } catch {
      onItemUpdated(item.id, { status: previousStatus });
      toast.error('Unable to update that item');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {COLUMNS.map((column) => {
        const columnItems = grouped[column.key] ?? [];
        const Icon = column.icon;
        return (
          <div
            key={column.key}
            className="flex flex-col gap-3 rounded-3xl border border-slate-200/70 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/50"
          >
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{column.label}</span>
              </div>
              <Badge variant="outline" className="rounded-full text-xs">
                {columnItems.length}
              </Badge>
            </div>

            <div className="flex min-h-[80px] flex-col gap-2">
              <AnimatePresence mode="popLayout">
                {columnItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <p className="text-sm font-medium leading-snug text-foreground">{item.description}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {item.assignee_email} · {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'No due date'}
                    </p>
                    {item.recurrence_count ? (
                      <div className="mt-2">
                        <ZombieTaskBadge recurrenceCount={item.recurrence_count} />
                      </div>
                    ) : null}
                    <div className="mt-2.5 flex items-center gap-1.5">
                      {column.key !== 'done' ? (
                        <Button
                          size="xs"
                          variant="outline"
                          className="rounded-full"
                          disabled={pendingId === item.id}
                          onClick={() => handleAdvance(item)}
                        >
                          {pendingId === item.id ? 'Saving…' : 'Mark done'}
                          <ChevronRight className="ml-1 h-3 w-3" />
                        </Button>
                      ) : (
                        <Badge className="rounded-full bg-emerald-100 text-emerald-800">Completed</Badge>
                      )}
                      {isAdmin && column.key !== 'done' && onSendReminder ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          className="rounded-full"
                          onClick={() => onSendReminder(item.id)}
                        >
                          Nudge
                        </Button>
                      ) : null}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {columnItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs text-muted-foreground dark:border-slate-800">
                  Nothing here
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}