import { Mic } from 'lucide-react';

export function CallDisclosureBanner({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 ${className ?? ''}`}
    >
      <Mic className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Live captions use this browser&apos;s mic — other participants aren&apos;t automatically notified.
      </p>
    </div>
  );
}