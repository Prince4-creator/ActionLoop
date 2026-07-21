'use client';

import { DollarSign, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MeetingCostCard({
  totalCostThisMonth,
  totalCostLastMonth,
  meetingCountThisMonth,
  isAdmin,
}: {
  totalCostThisMonth: number;
  totalCostLastMonth: number;
  meetingCountThisMonth: number;
  isAdmin: boolean;
}) {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  const hasLastMonth = totalCostLastMonth > 0;
  const deltaPercent = hasLastMonth
    ? Math.round(((totalCostThisMonth - totalCostLastMonth) / totalCostLastMonth) * 100)
    : null;

  const DeltaIcon = deltaPercent === null || deltaPercent === 0 ? Minus : deltaPercent > 0 ? TrendingUp : TrendingDown;
  const deltaClass =
    deltaPercent === null || deltaPercent === 0
      ? 'text-slate-400 dark:text-slate-500'
      : deltaPercent > 0
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div
      className={cn(
        'flex h-full flex-col justify-between rounded-3xl border p-6 shadow-sm backdrop-blur',
        isAdmin
          ? 'border-white/10 bg-white/5 text-white'
          : 'border-slate-200/80 bg-white/80 text-slate-900 dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-100'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Meeting cost this month</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {formatter.format(totalCostThisMonth)}
          </p>
        </div>
        <div className="shrink-0 rounded-2xl bg-amber-50 p-3 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
          <DollarSign className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {meetingCountThisMonth} meeting{meetingCountThisMonth === 1 ? '' : 's'} · est. attendees × hourly rate
        </p>
        {hasLastMonth ? (
          <span className={cn('flex shrink-0 items-center gap-1 text-sm font-medium', deltaClass)}>
            <DeltaIcon className="h-3.5 w-3.5" />
            {Math.abs(deltaPercent!)}% vs last month
          </span>
        ) : (
          <span className="text-sm text-slate-400 dark:text-slate-500">No data for last month yet</span>
        )}
      </div>
    </div>
  );
}