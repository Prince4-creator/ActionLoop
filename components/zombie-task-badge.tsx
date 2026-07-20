import { Flame } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function ZombieTaskBadge({ recurrenceCount }: { recurrenceCount: number | null | undefined }) {
  if (!recurrenceCount || recurrenceCount < 3) return null;

  return (
    <Badge variant="destructive" className="rounded-full gap-1">
      <Flame className="h-3 w-3" />
      Asked {recurrenceCount}x, still not done
    </Badge>
  );
}