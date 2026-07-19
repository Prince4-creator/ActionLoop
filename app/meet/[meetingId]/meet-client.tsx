'use client';

import { useState } from 'react';
import { VideoMeeting } from '@/components/video-meeting';
import { getMeetingRoomName } from '@/lib/video-room';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandBadge } from '@/components/ui/brand-badge';

export default function MeetClient({
  meetingId,
  meetingTitle,
}: {
  meetingId: string;
  meetingTitle: string | null;
}) {
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);

  const roomName = getMeetingRoomName(meetingId);

  if (!joined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm space-y-5 rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center shadow-2xl">
          <div className="flex justify-center">
            <BrandBadge className="h-14 w-14 rounded-2xl" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">{meetingTitle || 'Video call'}</h1>
            <p className="mt-1 text-sm text-slate-400">Enter your name to join as a guest.</p>
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="bg-white/10 text-white placeholder:text-slate-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) setJoined(true);
            }}
          />
          <Button className="w-full rounded-2xl" disabled={!name.trim()} onClick={() => setJoined(true)}>
            Join meeting
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 p-4">
      <VideoMeeting roomName={roomName} guestName={name.trim()} height="calc(100vh - 2rem)" />
    </div>
  );
}