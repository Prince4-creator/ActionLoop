'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseLiveTranscriptOptions {
  onFinalLine?: (line: string) => void;
}

interface UseLiveTranscriptResult {
  isSupported: boolean;
  isListening: boolean;
  interimText: string;
  finalLines: string[];
  fullTranscript: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
  error: string | null;
}

// 'network' and 'no-speech' are transient — recognition can just be restarted.
// Everything else (permissions, missing mic, etc.) needs the user to act, so
// we stop retrying and surface it instead of looping forever.
const RECOVERABLE_ERRORS = new Set(['network', 'no-speech']);
const MAX_NETWORK_RETRIES = 5;
const MAX_BACKOFF_MS = 8000;

export function useLiveTranscript(options: UseLiveTranscriptOptions = {}): UseLiveTranscriptResult {
  const recognitionRef = useRef<any>(null);
  const shouldRestartRef = useRef(false);
  const retryCountRef = useRef(0);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [finalLines, setFinalLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctor =
      typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
    setIsSupported(Boolean(ctor));
  }, []);

  const clearRestartTimeout = () => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  };

  const start = useCallback(() => {
    const ctor =
      typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

    if (!ctor) {
      setError('Live captions are not supported in this browser. Try Chrome or Edge.');
      return;
    }

    clearRestartTimeout();
    retryCountRef.current = 0;
    setError(null);
    shouldRestartRef.current = true;

    const recognition = new ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      // A successful result proves the connection recovered — clear any
      // stale error/backoff state left over from an earlier restart.
      if (retryCountRef.current > 0) retryCountRef.current = 0;
      setError((current) => (current ? null : current));

      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) {
          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const line = `[${timestamp}] ${text.trim()}`;
          setFinalLines((current) => [...current, line]);
          options.onFinalLine?.(line);
        } else {
          interim += text;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'aborted') return; // caused by our own stop()/restart, not a real error

      if (RECOVERABLE_ERRORS.has(event.error)) {
        if (event.error === 'network') {
          retryCountRef.current += 1;
          if (retryCountRef.current > MAX_NETWORK_RETRIES) {
            shouldRestartRef.current = false;
            setError('Live captions lost connection repeatedly and stopped. Check your network, then press the mic button to try again.');
          }
          // else: stay quiet and let onend's backoff restart handle it —
          // no need to flash a scary error for a connection blip.
        }
        // 'no-speech' just means silence; onend will restart immediately, no error shown.
        return;
      }

      // Fatal / non-recoverable (not-allowed, audio-capture, service-not-allowed, etc.)
      shouldRestartRef.current = false;
      setError(`Transcription error: ${event.error}`);
    };

    recognition.onend = () => {
      if (shouldRestartRef.current) {
        const delay = retryCountRef.current > 0
          ? Math.min(1000 * 2 ** (retryCountRef.current - 1), MAX_BACKOFF_MS)
          : 0;

        clearRestartTimeout();
        restartTimeoutRef.current = setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // ignore double-start races
          }
        }, delay);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start live captions');
    }
  }, [options]);

  const stop = useCallback(() => {
    shouldRestartRef.current = false;
    clearRestartTimeout();
    retryCountRef.current = 0;
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimText('');
  }, []);

  const reset = useCallback(() => {
    setFinalLines([]);
    setInterimText('');
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      clearRestartTimeout();
      recognitionRef.current?.stop();
    };
  }, []);

  return {
    isSupported,
    isListening,
    interimText,
    finalLines,
    fullTranscript: finalLines.join('\n'),
    start,
    stop,
    reset,
    error,
  };
}