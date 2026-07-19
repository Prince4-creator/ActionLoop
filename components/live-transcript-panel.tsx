'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, RotateCcw } from 'lucide-react';
import { useLiveTranscript } from '@/lib/use-live-transcript';

interface LiveTranscriptPanelProps {
  autoStart?: boolean;
  onTranscriptChange?: (transcript: string) => void;
}

export function LiveTranscriptPanel({ autoStart = false, onTranscriptChange }: LiveTranscriptPanelProps) {
  const { isSupported, isListening, interimText, finalLines, fullTranscript, start, stop, reset, error } =
    useLiveTranscript();

  useEffect(() => {
    if (autoStart && isSupported) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, isSupported]);

  useEffect(() => {
    onTranscriptChange?.(fullTranscript);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullTranscript]);

  if (!isSupported) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Live captions aren't supported in this browser. Try Chrome or Edge, or paste a transcript manually after the call.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Badge className={isListening ? 'rounded-full bg-red-100 text-red-800' : 'rounded-full bg-slate-100 text-slate-600'}>
            {isListening ? '● Capturing' : 'Paused'}
          </Badge>
          <span className="text-xs text-slate-500">Captions from this tab's mic</span>
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-full"
            onClick={isListening ? stop : start}
            title={isListening ? 'Pause capturing' : 'Start capturing'}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="icon-sm" className="rounded-full" onClick={reset} title="Clear transcript">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-3 text-sm" style={{ maxHeight: 260 }}>
        {finalLines.length === 0 && !interimText ? (
          <p className="text-slate-400">Captions will appear here once you speak.</p>
        ) : (
          <>
            {finalLines.map((line, i) => (
              <p key={i} className="text-slate-700 dark:text-slate-200">
                {line}
              </p>
            ))}
            {interimText ? <p className="italic text-slate-400">{interimText}</p> : null}
          </>
        )}
      </div>

      {error ? <div className="border-t border-slate-200 p-2 text-xs text-red-600 dark:border-slate-800">{error}</div> : null}
    </div>
  );
}