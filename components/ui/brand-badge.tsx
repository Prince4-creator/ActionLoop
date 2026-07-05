import { cn } from '@/lib/utils';

type BrandBadgeProps = {
  className?: string;
  compact?: boolean;
};

export function BrandBadge({ className, compact = false }: BrandBadgeProps) {
  return (
    <div
      aria-label="ActionLoop badge"
      className={cn(
        'relative inline-flex items-center justify-center overflow-hidden rounded-2xl border border-slate-300/50 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.14)] ring-1 ring-slate-300/30',
        compact ? 'h-10 w-10' : 'h-16 w-16',
        className
      )}
    >
      <img
        src="/favicon.svg"
        alt="ActionLoop logo"
        className={cn('h-full w-full rounded-[1.4rem] object-cover', compact ? 'p-1' : 'p-2')}
      />
    </div>
  );
}