'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TrendPoint = {
  /** Short label for the bucket, e.g. "Jun 30" or "W1" */
  label: string;
  /** Average outcome_score (0-100) for that bucket */
  score: number;
  /** How many meetings fed into this bucket, so 0-meeting weeks can be shown as gaps */
  count: number;
};

export function FollowThroughTrend({
  points,
  currentScore,
  isAdmin,
}: {
  points: TrendPoint[];
  currentScore: number;
  isAdmin: boolean;
}) {
  const usablePoints = useMemo(() => points.filter((p) => p.count > 0), [points]);

  const { linePath, areaPath } = useMemo(() => {
    if (usablePoints.length < 2) return { linePath: '', areaPath: '' };

    const width = 200;
    const height = 56;
    const values = usablePoints.map((p) => p.score);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const stepX = width / (usablePoints.length - 1);

    const coords = usablePoints.map((p, i) => {
      const x = i * stepX;
      const y = height - ((p.score - min) / span) * (height - 8) - 4;
      return [x, y] as const;
    });

    const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

    return { linePath, areaPath };
  }, [usablePoints]);

  const trendDirection = useMemo(() => {
    if (usablePoints.length < 2) return 'flat' as const;
    const delta = usablePoints[usablePoints.length - 1].score - usablePoints[0].score;
    if (delta > 3) return 'up' as const;
    if (delta < -3) return 'down' as const;
    return 'flat' as const;
  }, [usablePoints]);

  const TrendIcon = trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus;

  const accentClass = isAdmin ? 'text-violet-400' : 'text-emerald-500';
  const trendLabelClass =
    trendDirection === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : trendDirection === 'down'
      ? 'text-red-500 dark:text-red-400'
      : 'text-slate-400 dark:text-slate-500';

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
        <svg viewBox="0 0 120 120" className="h-14 w-14 -rotate-90">
          <circle
            cx="60"
            cy="60"
            r="48"
            stroke="currentColor"
            strokeWidth="10"
            className="text-slate-200 dark:text-white/10"
            fill="none"
          />
          <motion.circle
            cx="60"
            cy="60"
            r="48"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
            className={accentClass}
            initial={{ strokeDasharray: 301.59, strokeDashoffset: 301.59 }}
            animate={{
              strokeDasharray: 301.59,
              strokeDashoffset: 301.59 - (301.59 * currentScore) / 100,
            }}
            transition={{ duration: 0.8 }}
          />
        </svg>
        <span className="absolute text-xs font-semibold text-slate-700 dark:text-slate-200">{currentScore}%</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {usablePoints.length > 1 ? `Last ${usablePoints.length} weeks` : 'Not enough history yet'}
          </p>
          {usablePoints.length > 1 ? (
            <span className={cn('flex items-center gap-1 text-xs font-medium', trendLabelClass)}>
              <TrendIcon className="h-3 w-3" />
              {trendDirection === 'up' ? 'Improving' : trendDirection === 'down' ? 'Slipping' : 'Steady'}
            </span>
          ) : null}
        </div>

        {usablePoints.length > 1 ? (
          <svg viewBox="0 0 200 56" className="h-10 w-full overflow-visible" preserveAspectRatio="none">
            <defs>
              <linearGradient id="follow-through-trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path
              d={areaPath}
              fill="url(#follow-through-trend-fill)"
              className={accentClass}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            />
            <motion.path
              d={linePath}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={accentClass}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </svg>
        ) : (
          <div className="flex h-10 items-center">
            <p className="text-xs text-slate-400 dark:text-slate-500">Check back after a few more weeks of meetings.</p>
          </div>
        )}
      </div>
    </div>
  );
}