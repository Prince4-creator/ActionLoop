import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  actionOnClick?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  actionOnClick,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('group/card rounded-3xl border border-white/20 bg-white/80 p-10 text-center shadow-xl backdrop-blur dark:border-slate-700/50 dark:bg-slate-950/70 dark:text-slate-100', className)}>
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100/70 text-slate-700 shadow-sm dark:bg-slate-900/60 dark:text-slate-100">
        {icon}
      </div>
      <h3 className="mt-6 text-2xl font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">{description}</p>
      {actionLabel && (actionHref || actionOnClick) ? (
        <div className="mt-6">
          <Button
            asChild
            className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg"
            onClick={actionOnClick}
          >
            {actionHref ? <a href={actionHref}>{actionLabel}</a> : actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
