'use client';

import Link from 'next/link';
import { Crown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LeaderboardEntry = {
  user_id: string;
  email: string | null;
  score: number;
  done: number;
  total: number;
};

export function TeamLeaderboardMini({
  entries,
  isAdmin,
}: {
  entries: LeaderboardEntry[];
  isAdmin: boolean;
}) {
  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-3xl border p-6 shadow-sm backdrop-blur',
        isAdmin
          ? 'border-white/10 bg-white/5 text-white'
          : 'border-slate-200/80 bg-white/80 text-slate-900 dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-100'
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Top closers this month</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Based on action items completed</p>
        </div>
        <Link
          href="/team"
          className="flex shrink-0 items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {entries.length > 0 ? (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div
              key={entry.user_id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white',
                    index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-400' : 'bg-orange-400'
                  )}
                >
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {entry.email || 'Unknown member'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {entry.done}/{entry.total} completed
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {index === 0 ? <Crown className="h-4 w-4 text-amber-500" /> : null}
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                  {entry.score}%
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
          No completed action items yet this month.
        </div>
      )}
    </div>
  );
}