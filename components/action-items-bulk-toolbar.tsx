'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { markActionItemDone } from '@/app/actions/meetings';

/**
 * Bulk-select toolbar for a meeting's action items, mirroring the pattern
 * already used in app/admin/admin-dashboard-client.tsx for users.
 *
 * Integration into app/meetings/[id]/meeting-detail-client.tsx:
 *
 *   const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 *   ...
 *   <ActionItemsBulkToolbar
 *     items={visibleItems}
 *     selectedIds={selectedIds}
 *     onSelectedIdsChange={setSelectedIds}
 *     onItemsMarkedDone={(ids) => setActionItems(current =>
 *       current.map(i => ids.includes(i.id) ? { ...i, status: 'done' } : i)
 *     )}
 *   />
 *
 * And render a checkbox next to each item using the same toggle pattern
 * shown in the admin users table (CheckSquare / Square icons).
 */

type MinimalItem = { id: string; status: string };

export function ActionItemsBulkToolbar({
  items,
  selectedIds,
  onSelectedIdsChange,
  onItemsMarkedDone,
}: {
  items: MinimalItem[];
  selectedIds: Set<string>;
  onSelectedIdsChange: (next: Set<string>) => void;
  onItemsMarkedDone: (ids: string[]) => void;
}) {
  const [isPending, setIsPending] = useState(false);

  const selectableItems = items.filter((item) => item.status !== 'done');
  const hasSelectableItems = selectableItems.length > 0;
  const allSelected = hasSelectableItems && selectableItems.every((item) => selectedIds.has(item.id));

  const toggleSelectAll = () => {
    if (!hasSelectableItems) {
      // Nothing to select — everything currently in view is already done.
      // Surface that instead of leaving the click looking like it did nothing.
      toast.info('Nothing to select — every item here is already marked done.');
      return;
    }

    if (allSelected) {
      onSelectedIdsChange(new Set());
      return;
    }
    const next = new Set(selectedIds);
    selectableItems.forEach((item) => next.add(item.id));
    onSelectedIdsChange(next);
  };

  const handleMarkSelectedDone = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    setIsPending(true);
    try {
      // Fire sequentially to reuse the existing single-item server action
      // without adding a new bulk API route. For large batches, add a
      // dedicated bulk endpoint instead.
      for (const id of ids) {
        await markActionItemDone(id);
      }
      onItemsMarkedDone(ids);
      onSelectedIdsChange(new Set());
      toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} marked as done`);
    } catch {
      toast.error('Some items could not be updated');
    } finally {
      setIsPending(false);
    }
  };

  if (selectedIds.size === 0) {
    return (
      <button
        type="button"
        onClick={toggleSelectAll}
        disabled={!hasSelectableItems}
        aria-disabled={!hasSelectableItems}
        title={hasSelectableItems ? undefined : 'Everything in this view is already done'}
        className={
          hasSelectableItems
            ? 'flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground'
            : 'flex items-center gap-2 text-xs text-muted-foreground/50 cursor-not-allowed'
        }
      >
        {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        Select all
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-200/60 bg-blue-50/70 px-4 py-2.5 dark:border-blue-500/20 dark:bg-blue-500/10">
      <span className="text-sm text-foreground">{selectedIds.size} selected</span>
      <div className="ml-auto flex gap-2">
        <Button size="sm" disabled={isPending} onClick={handleMarkSelectedDone} className="rounded-full">
          {isPending ? 'Saving…' : 'Mark done'}
        </Button>
        <Button size="sm" variant="ghost" className="rounded-full" onClick={() => onSelectedIdsChange(new Set())}>
          Clear
        </Button>
      </div>
    </div>
  );
}