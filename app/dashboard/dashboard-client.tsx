'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { ArrowRight, BellRing, CheckCircle2, Clock3, ShieldCheck, Sparkles, Users, AlertTriangle } from 'lucide-react';
import { markActionItemDone } from '@/app/actions/meetings';
import { sendReminders } from '@/app/actions/reminders';
import { toast } from 'sonner';

type MeetingSummary = {
  id: string;
  user_id: string;
  title: string | null;
  summary: string | null;
  created_at?: string;
  outcome_score: number;
};

type ActionItemSummary = {
  id: string;
  description: string;
  assignee_email: string;
  due_date: string | null;
  status: string;
  meeting_id: string;
};

export default function DashboardClient({
  user,
  isAdmin,
  meetings,
  counts,
  actionItems,
  overdueCount,
  completionPercent,
  averageOutcomeScore,
}: {
  user: { id?: string; email?: string | null };
  isAdmin: boolean;
  meetings: MeetingSummary[];
  counts: { total: number; your: number; shared: number };
  actionItems: ActionItemSummary[];
  overdueCount: number;
  completionPercent: number;
  averageOutcomeScore: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [pendingItems, setPendingItems] = useState(actionItems);
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [reminderLimit, setReminderLimit] = useState(10);
  const isOwner = (meeting: MeetingSummary) => meeting.user_id === user.id;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push('/login');
  };

 const heroClasses = isAdmin
    ? 'from-indigo-600 via-violet-600 to-fuchsia-600'
    : 'from-emerald-600 via-teal-600 to-cyan-600';

  const handleDone = async (itemId: string) => {
    setPendingItems((current) => current.filter((item) => item.id !== itemId));
    try {
      await markActionItemDone(itemId);
      toast.success('Action item marked as done');
    } catch {
      toast.error('Unable to update that action item');
    }
  };

  useEffect(() => {
    const loadReminderLimit = async () => {
      try {
        const response = await fetch('/api/admin/reminders/settings');
        if (!response.ok) return;
        const data = await response.json();
        if (typeof data.reminderLimit === 'number') {
          setReminderLimit(data.reminderLimit);
        }
      } catch {
        // ignore
      }
    };

    void loadReminderLimit();
  }, []);

  const handleSendReminders = async () => {
    if (!isAdmin) {
      toast.error('Only admins can send reminders');
      return;
    }

    setIsSendingReminders(true);
    try {
      const result = await sendReminders();
      toast.success(`${result.sent} reminder${result.sent === 1 ? '' : 's'} sent${result.reminderLimit ? ` (limit: ${result.reminderLimit})` : ''}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Unable to send reminders');
    } finally {
      setIsSendingReminders(false);
    }
  };

 return (
    <div className={isAdmin
      ? 'min-h-screen'
      : 'min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_45%),linear-gradient(135deg,_#f8fbff_0%,_#eef7ff_100%)]'
    }>
      <div className="mx-auto flex w-full max-w-full flex-1 flex-col p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-slate-500">Meeting workspace</p>
            <h1 className="text-3xl font-semibold text-slate-900">{isAdmin ? 'Admin Control Center' : 'Your Meeting Hub'}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className={isAdmin ? 'rounded-full bg-blue-100 text-blue-800 hover:bg-blue-100' : 'rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100'}>
              {isAdmin ? 'Admin access' : 'Member access'}
            </Badge>
            {isAdmin ? (
              <Link
                href="/admin"
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                Open admin panel
              </Link>
            ) : null}
            <span className="text-sm text-slate-500">{user.email}</span>
            <Button variant="secondary" size="sm" className="rounded-2xl bg-white/95 text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100" onClick={handleSignOut}>
              <Icons.logout className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>

        {overdueCount > 0 ? (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-3xl border border-red-200 bg-gradient-to-r from-red-500 to-rose-500 p-4 text-white shadow-lg">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <p className="font-semibold">{overdueCount} overdue action item{overdueCount === 1 ? '' : 's'}</p>
                  <p className="text-sm text-red-50">Follow up quickly to keep momentum going.</p>
                </div>
              </div>
              {isAdmin ? (
                <Button variant="secondary" size="sm" onClick={handleSendReminders} disabled={isSendingReminders} className="rounded-2xl bg-white/20 text-white hover:bg-white/30">
                  {isSendingReminders ? <Icons.spinner className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
                  Send reminders
                </Button>
              ) : (
                <div className="rounded-2xl border border-white/30 bg-white/15 px-4 py-3 text-sm text-white">
                  Reminder sending is available to workspace admins only.
                </div>
              )}
            </div>
          </motion.div>
        ) : null}

        <Card className={`overflow-hidden border-0 bg-gradient-to-r text-white shadow-xl ${heroClasses}`}>
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-white/20 text-white backdrop-blur">{isAdmin ? 'Workspace overview' : 'Personal overview'}</Badge>
                  <Badge variant="outline" className="rounded-full border-white/30 bg-white/10 text-white">
                    {isAdmin ? 'Monitoring all meetings' : 'Focused on your flow'}
                  </Badge>
                </div>
                <h2 className="text-2xl font-semibold sm:text-3xl">Welcome back, {user.email?.split('@')[0] || 'there'}</h2>
                <p className="mt-2 max-w-xl text-sm text-blue-50 sm:text-base">
                  {isAdmin
                    ? 'Keep an eye on every meeting, review progress, and stay on top of the workspace.'
                    : 'Capture highlights, follow up on action items, and jump back into your latest meetings.'}
                </p>
              </div>
              <Link href="/meetings/new">
                <Button className="rounded-2xl border border-white/30 bg-white/15 text-white backdrop-blur hover:bg-white/25">
                  <Sparkles className="mr-2 h-4 w-4" />
                  New Meeting
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <Card className={isAdmin
  ? 'border-indigo-100 bg-white text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white dark:backdrop-blur'
  : 'border-slate-200/80 bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Follow-through score</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{averageOutcomeScore}%</p>
                </div>
                <div className="relative flex h-14 w-14 items-center justify-center">
                  <svg viewBox="0 0 120 120" className="h-14 w-14 -rotate-90">
                    <circle cx="60" cy="60" r="48" stroke="currentColor" strokeWidth="10" className="text-slate-200" fill="none" />
                    <motion.circle cx="60" cy="60" r="48" stroke="currentColor" strokeWidth="10" strokeLinecap="round" fill="none" className="text-emerald-500" initial={{ strokeDasharray: 301.59, strokeDashoffset: 301.59 }} animate={{ strokeDasharray: 301.59, strokeDashoffset: 301.59 - (301.59 * averageOutcomeScore) / 100 }} transition={{ duration: 0.8 }} />
                  </svg>
                  <span className="absolute text-xs font-semibold text-slate-700 dark:text-slate-200">{averageOutcomeScore}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={isAdmin
  ? 'border-white/10 bg-white/5 text-white shadow-sm backdrop-blur'
  : 'border-slate-200/80 bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Your meetings</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{counts.your}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-200">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={isAdmin
  ? 'border-white/10 bg-white/5 text-white shadow-sm backdrop-blur'
  : 'border-slate-200/80 bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Shared / team</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{counts.shared}</p>
                </div>
                <div className="rounded-2xl bg-violet-50 p-3 text-violet-600 dark:bg-violet-500/15 dark:text-violet-200">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
<div className={isAdmin
  ? 'rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-sm backdrop-blur'
  : 'rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-100'
}>            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{isAdmin ? 'Workspace meetings' : 'Recent meetings'}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{isAdmin ? 'A quick view of everything currently in the workspace.' : 'Pick up where you left off.'}</p>
              </div>
              <Badge variant="outline" className="rounded-full bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-100">{meetings.length} total</Badge>
            </div>
            <div className="mt-6">
              {meetings.length > 0 ? (
                <div className="grid gap-4">
                  {meetings.map((meeting) => (
                    <Link key={meeting.id} href={`/meetings/${meeting.id}`}>
                      <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-semibold text-slate-900 dark:text-slate-100">{meeting.title || 'Untitled Meeting'}</h4>
                                <Badge className={isOwner(meeting) ? 'rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-800/15 dark:text-emerald-200' : 'rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200'}>
                                  {isOwner(meeting) ? 'Your meeting' : isAdmin ? 'Shared access' : 'Meeting'}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300 line-clamp-2">{meeting.summary || 'No summary available yet.'}</p>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <Clock3 className="h-4 w-4" />
                              <span>{meeting.created_at ? new Date(meeting.created_at).toLocaleDateString() : 'Recently created'}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                  <p className="font-medium text-slate-700">No meetings yet.</p>
                  <p className="mt-2 text-sm">Create your first meeting and everything will appear here.</p>
                </div>
              )}
            </div>
          </div>

          <div className={isAdmin
  ? 'rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-sm backdrop-blur'
  : 'rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-100'
}>
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Quick action items</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Stay ahead of the next follow-up.</p>
              </div>
              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-500 dark:text-slate-400">
                    <span className="mr-2">Limit</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={reminderLimit}
                      onChange={(event) => setReminderLimit(Number(event.target.value || 10))}
                      className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-2xl"
                    onClick={async () => {
                      try {
                        await fetch('/api/admin/reminders/settings', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ reminderLimit }),
                        });
                      } catch {
                        // ignore
                      }
                      await handleSendReminders();
                    }}
                    disabled={isSendingReminders}
                  >
                    {isSendingReminders ? <Icons.spinner className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
                    Send reminders
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
                  Reminder sending is restricted to admins.
                </div>
              )}
            </div>
            {pendingItems.length > 0 ? (
              <div className="space-y-3">
                {pendingItems.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{item.description}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.assignee_email} · {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'No due date'}</p>
                    </div>
                    <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => handleDone(item.id)}>
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Everything is clear for now. Nice work.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}