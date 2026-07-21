'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CallDisclosureBanner } from '@/components/ui/call-disclosure-banner';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Icons } from '@/components/ui/icons';
import { ArrowLeft, ShieldCheck, Video, VideoOff } from 'lucide-react';
import { VideoMeeting } from '@/components/video-meeting';
import { LiveTranscriptPanel } from '@/components/live-transcript-panel';
import { generateAdhocRoomName } from '@/lib/video-room';

export default function NewMeetingClient({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [liveMode, setLiveMode] = useState(false);
  const [roomName] = useState(() => generateAdhocRoomName());
  const [liveTranscriptDraft, setLiveTranscriptDraft] = useState('');

  const [agendaSuggestion, setAgendaSuggestion] = useState<{
    priorMeetingTitle: string;
    openItems: Array<{ description: string; assignee_email: string; due_date: string | null }>;
    staleDesiredOutcome: string | null;
  } | null>(null);

  useEffect(() => {
    if (!title.trim() || title.trim().length < 3) {
      setAgendaSuggestion(null);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/meetings/agenda-suggestions?title=${encodeURIComponent(title.trim())}`);
        const json = await res.json();
        setAgendaSuggestion(json.suggestion ?? null);
      } catch {
        setAgendaSuggestion(null);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [title]);

  const handleInsertAgenda = () => {
    if (!agendaSuggestion) return;
    const lines: string[] = [`Agenda carried over from "${agendaSuggestion.priorMeetingTitle}":`];
    if (agendaSuggestion.staleDesiredOutcome) {
      lines.push(`- Still open: ${agendaSuggestion.staleDesiredOutcome}`);
    }
    for (const item of agendaSuggestion.openItems) {
      const due = item.due_date ? ` (due ${item.due_date})` : '';
      lines.push(`- Follow up: ${item.description} — ${item.assignee_email}${due}`);
    }
    setNotes((current) => (current ? `${lines.join('\n')}\n\n${current}` : lines.join('\n')));
  };

  const handleStartLiveCall = () => {
    setLiveMode(true);
    setLiveTranscriptDraft('');
  };

  const handleEndLiveCall = () => {
    setLiveMode(false);
    setTranscript((current) => (current ? `${current}\n${liveTranscriptDraft}` : liveTranscriptDraft));
    toast.success('Transcript filled in from the call — review it below before extracting.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcript) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('desired_outcome', desiredOutcome);
      formData.append('notes', notes);
      formData.append('transcript', transcript);

      const res = await fetch('/api/meetings/create', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to process meeting');
      toast.success('Meeting processed!');
      router.push(`/meetings/${json.meetingId}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to process meeting';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <div className="mb-4">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="rounded-2xl">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard
            </Button>
          </Link>
        </div>

        <Card className="backdrop-blur-xl bg-white/80 dark:bg-card/90 text-black dark:text-card-foreground border-0 shadow-2xl rounded-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">{isAdmin ? 'New Meeting' : 'Meeting Request'}</CardTitle>
            <CardDescription>
              {isAdmin
                ? 'Start a live call or paste a transcript, and let AI extract the action items.'
                : 'Meeting scheduling is currently handled by workspace admins. You can request a meeting or return to your dashboard.'}
            </CardDescription>
          </CardHeader>
          <CardContent>

            {isAdmin ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Meeting Title (optional)</label>
                  <Input
                    placeholder="Weekly Sprint Review"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Desired outcome (optional)</label>
                  <Textarea
                    placeholder="Describe what success looks like for this meeting"
                    value={desiredOutcome}
                    onChange={(e) => setDesiredOutcome(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Notes (optional)</label>
                  <Textarea
                    placeholder="Add context, follow-up notes, or internal comments"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="rounded-xl min-h-[120px]"
                  />
                </div>

                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Live video call</p>
                      <p className="text-xs text-slate-500">Talk it through and let captions fill the transcript below.</p>
                    </div>
                    {!liveMode ? (
                      <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={handleStartLiveCall}>
                        <Video className="mr-2 h-4 w-4" /> Start live call
                      </Button>
                    ) : (
                      <Button type="button" variant="destructive" size="sm" className="rounded-xl" onClick={handleEndLiveCall}>
                        <VideoOff className="mr-2 h-4 w-4" /> End call & fill transcript
                      </Button>
                    )}
                  </div>

                  {/* Shown before the call starts, so the disclosure is read before the mic goes live. */}
                  {!liveMode ? <CallDisclosureBanner className="mt-3" /> : null}

                  {liveMode ? (
                    <div className="mt-4 space-y-3">
                      <CallDisclosureBanner />
                      <p className="text-xs text-slate-400">Tip: use the expand icon on the video to go fullscreen.</p>
                      <div className="grid gap-3 lg:grid-cols-2">
                        <VideoMeeting roomName={roomName} height={320} />
                        <LiveTranscriptPanel autoStart onTranscriptChange={setLiveTranscriptDraft} />
                      </div>
                    </div>
                  ) : null}
                </div>

                {agendaSuggestion && (agendaSuggestion.openItems.length > 0 || agendaSuggestion.staleDesiredOutcome) ? (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm">
                    <p className="font-semibold text-blue-900">
                      Suggested agenda from "{agendaSuggestion.priorMeetingTitle}"
                    </p>
                    <ul className="mt-2 space-y-1 text-blue-800">
                      {agendaSuggestion.staleDesiredOutcome ? (
                        <li>• Still open: {agendaSuggestion.staleDesiredOutcome}</li>
                      ) : null}
                      {agendaSuggestion.openItems.slice(0, 5).map((item, i) => (
                        <li key={i}>
                          • {item.description} — {item.assignee_email}
                          {item.due_date ? ` (due ${item.due_date})` : ''}
                        </li>
                      ))}
                    </ul>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 rounded-xl"
                      onClick={handleInsertAgenda}
                    >
                      Insert into notes
                    </Button>
                  </div>
                ) : null}

                <div>
                  <label className="text-sm font-medium block mb-1">Transcript *</label>
                  <Textarea
                    placeholder="Paste your meeting transcript here, or start a live call above..."
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    className="rounded-xl min-h-[200px]"
                    required
                  />
                </div>
                
                <Button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white"
                  disabled={isLoading || !transcript}
                >
                  {isLoading ? (
                    <Icons.spinner className="mr-2 h-5 w-5 animate-spin" />
                  ) : null}
                  Extract Actions
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5" />
                    <div>
                      <p className="font-semibold">Only admins can create meetings directly.</p>
                      <p className="mt-1 text-amber-700">You can request a meeting and an admin will review it.</p>
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const data = { title, message: transcript };
                    try {
                      const res = await fetch('/api/meetings/request', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data),
                      });
                      const json = await res.json();
                      if (!res.ok || json.error) throw new Error(json.error || 'Request failed');
                      toast.success('Meeting request sent');
                      router.push('/dashboard');
                    } catch (err: unknown) {
                      toast.error(err instanceof Error ? err.message : 'Unable to request meeting');
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-sm font-medium block mb-1">Meeting title (optional)</label>
                    <Input placeholder="Optional title" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Message to admins (optional)</label>
                    <Textarea placeholder="Describe the request or attach details" value={transcript} onChange={(e) => setTranscript(e.target.value)} className="rounded-xl min-h-[140px]" />
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" className="rounded-xl bg-amber-600 text-white">Request meeting</Button>
                    <Link href="/dashboard">
                      <Button variant="outline" className="rounded-xl">Back to dashboard</Button>
                    </Link>
                  </div>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}