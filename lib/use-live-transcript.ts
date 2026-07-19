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

export function useLiveTranscript(options: UseLiveTranscriptOptions = {}): UseLiveTranscriptResult {
  const recognitionRef = useRef<any>(null);
  const shouldRestartRef = useRef(false);
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

  const start = useCallback(() => {
    const ctor =
      typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

    if (!ctor) {
      setError('Live captions are not supported in this browser. Try Chrome or Edge.');
      return;
    }

    setError(null);
    shouldRestartRef.current = true;

    const recognition = new ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
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
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      setError(`Transcription error: ${event.error}`);
    };

    recognition.onend = () => {
      if (shouldRestartRef.current) {
        try {
          recognition.start();
        } catch {
          // ignore double-start
        }
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