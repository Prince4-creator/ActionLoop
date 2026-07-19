'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

let jitsiScriptPromise: Promise<void> | null = null;
let loadedScriptSrc: string | null = null;

function loadJitsiScript(src: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.JitsiMeetExternalAPI && loadedScriptSrc === src) return Promise.resolve();
  if (jitsiScriptPromise && loadedScriptSrc === src) return jitsiScriptPromise;

  loadedScriptSrc = src;
  jitsiScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Jitsi script')));
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Jitsi script'));
    document.body.appendChild(script);
  });

  return jitsiScriptPromise;
}

interface VideoMeetingProps {
  roomName: string;
  displayName?: string;
  onClose?: () => void;
  height?: number | string;
  /** If provided, joins as an unauthenticated guest via the public token endpoint */
  guestName?: string;
  /** Allow the caller to hide the fullscreen toggle (e.g. if already inside a fullscreen dialog) */
  allowFullscreen?: boolean;
}

export function VideoMeeting({
  roomName,
  displayName,
  onClose,
  height = 560,
  guestName,
  allowFullscreen = true,
}: VideoMeetingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const endpoint = guestName ? '/api/video/guest-token' : '/api/video/token';
        const body = guestName ? { room: roomName, name: guestName } : { room: roomName };

        const tokenRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const tokenJson = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenJson.error || 'Unable to start video call');

        const { token, appId } = tokenJson;
        const domain = '8x8.vc';
        const scriptSrc = `https://8x8.vc/${appId}/external_api.js`;

        await loadJitsiScript(scriptSrc);
        if (cancelled || !containerRef.current) return;

        apiRef.current = new window.JitsiMeetExternalAPI(domain, {
          roomName: `${appId}/${roomName}`,
          jwt: token,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: (displayName || guestName) ? { displayName: displayName || guestName } : undefined,
          configOverwrite: {
            prejoinPageEnabled: true,
            disableDeepLinking: true,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
          },
        });

        apiRef.current.addEventListener('videoConferenceLeft', () => {
          onClose?.();
        });

        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load video call');
          setIsLoading(false);
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!wrapperRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await wrapperRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen API can be blocked by browser/user settings — fail silently, button stays available.
    }
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl bg-slate-950/90 p-6 text-center text-sm text-white">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={
        isFullscreen
          ? 'relative w-full h-screen overflow-hidden bg-slate-950'
          : 'relative w-full overflow-hidden rounded-2xl bg-slate-950'
      }
      style={isFullscreen ? undefined : { height }}
    >
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
          Loading video call…
        </div>
      ) : null}
      {allowFullscreen && !isLoading && !error ? (
        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      ) : null}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}