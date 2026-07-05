'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { sendReminderForItem, deleteMeeting } from '@/utils/api';
import { markActionItemDone } from '@/app/actions/meetings';
import { ArrowLeft, CheckCircle2, Copy, Download, Filter, ListTodo } from 'lucide-react';
import MeetingShareForm from './meeting-share-form';

type MeetingRecord = {
  id: string;
  user_id: string;
  title?: string | null;
  summary?: string | null;
  notes?: string | null;
  desired_outcome?: string | null;
  decision?: string | null;
  outcome_score?: number;
};

type ActionItemRecord = {
  id: string;
  description: string;
  assignee_email: string;
  due_date: string | null;
  status: string;
};

type SharedMemberRecord = {
  email: string;
  created_at: string;
};

type MeetingDetailClientProps = {
  meeting: MeetingRecord;
  initialActionItems: ActionItemRecord[];
  initialSharedMembers: SharedMemberRecord[];
  canManageSharing: boolean;
  isAdmin: boolean;
};

export default function MeetingDetailClient({
  meeting,
  initialActionItems,
  initialSharedMembers,
  canManageSharing,
  isAdmin,
}: MeetingDetailClientProps) {
  const [actionItems, setActionItems] = useState(initialActionItems);
  const [title, setTitle] = useState(meeting.title ?? '');
  const [summary, setSummary] = useState(meeting.summary ?? '');
  const [notes, setNotes] = useState(meeting.notes ?? '');
  const [desiredOutcome, setDesiredOutcome] = useState(meeting.desired_outcome ?? '');
  const [decision, setDecision] = useState(meeting.decision ?? '');
  const [outcomeScore, setOutcomeScore] = useState(meeting.outcome_score ?? 0);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done' | 'overdue'>('all');
  const [sharedMembers, setSharedMembers] = useState(initialSharedMembers);

  const visibleItems = useMemo(() => {
    if (filter === 'all') return actionItems;
    return actionItems.filter((item) => item.status === filter);
  }, [actionItems, filter]);

  const handleDone = async (itemId: string) => {
    const currentItems = actionItems;
    setActionItems((current) => current.map((item) => (item.id === itemId ? { ...item, status: 'done' } : item)));
    try {
      const result = await markActionItemDone(itemId);
      const completedMeeting = (result as { completedMeeting?: { title?: string | null } } | null)?.completedMeeting;
      if (completedMeeting?.title) {
        confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
        toast.success(`🎉 Team completed all actions for ${completedMeeting.title}!`);
      } else {
        toast.success('Action item marked as done');
      }
    } catch {
      setActionItems(currentItems);
      toast.error('Unable to update that item');
    }
  };

  const router = useRouter();
  const [sendingReminders, setSendingReminders] = useState<string[]>([]);

  const handleSendReminder = async (itemId: string) => {
    if (sendingReminders.includes(itemId)) return;
    setSendingReminders((s) => [...s, itemId]);
    try {
      const result = await sendReminderForItem(itemId);
      toast.success(`${result.sent ?? 1} reminder sent`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to send reminder');
    } finally {
      setSendingReminders((s) => s.filter((id) => id !== itemId));
    }
  };

  const [deleting, setDeleting] = useState(false);

  const handleDeleteMeeting = async () => {
    if (!confirm('Delete this meeting and all its action items? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteMeeting(meeting.id);
      toast.success('Meeting deleted');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to delete meeting');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopySummary = async () => {
    const text = meeting.summary || `Meeting: ${meeting.title || 'Untitled meeting'}`;
    await navigator.clipboard.writeText(text);
    toast.success('Summary copied');
  };

  const handleExportCsv = () => {
    const header = ['Description', 'Assignee', 'Due Date', 'Status'];
    const rows = actionItems.map((item) => [item.description, item.assignee_email, item.due_date ?? '', item.status]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(meeting.title || 'meeting').replace(/\s+/g, '-').toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const statusClass = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-emerald-100 text-emerald-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-amber-100 text-amber-800';
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-full flex-col gap-6 px-4 sm:px-6 lg:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/dashboard" className="self-start">
          <Button variant="outline" size="sm" className="rounded-2xl">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-2xl" onClick={handleCopySummary}>
            <Copy className="mr-2 h-4 w-4" /> Copy summary
          </Button>
          <Button variant="outline" size="sm" className="rounded-2xl" onClick={handleExportCsv}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          {canManageSharing ? (
            isEditing ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" className="rounded-2xl" onClick={async () => {
                  setIsSaving(true);
                  try {
                    const res = await fetch('/api/meetings/update', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        meetingId: meeting.id,
                        title,
                        summary,
                        notes,
                        desired_outcome: desiredOutcome,
                        decision,
                        outcome_score: outcomeScore,
                      }),
                    });
                    const json = await res.json();
                    if (!res.ok || json.error) throw new Error(json.error || 'Save failed');
                    toast.success('Meeting updated');
                    setIsEditing(false);
                  } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : 'Unable to save');
                  } finally {
                    setIsSaving(false);
                  }
                }} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" className="rounded-2xl" onClick={() => {
                  setIsEditing(false);
                  setTitle(meeting.title ?? '');
                  setSummary(meeting.summary ?? '');
                  setNotes(meeting.notes ?? '');
                  setDesiredOutcome(meeting.desired_outcome ?? '');
                  setDecision(meeting.decision ?? '');
                  setOutcomeScore(meeting.outcome_score ?? 0);
                }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" className="rounded-2xl" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
                <Button size="sm" variant="destructive" className="rounded-2xl" onClick={handleDeleteMeeting} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            )
          ) : null}
        </div>
      </div>

      <Card className="rounded-3xl border-white/60 bg-white/80 shadow-sm backdrop-blur dark:bg-slate-900/70">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              {isEditing ? (
                <div className="space-y-4">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border bg-white/90 px-3 py-2 text-lg font-semibold text-slate-900 dark:bg-slate-800/80 dark:text-slate-100"
                  />
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-md border bg-white/90 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
                  />
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Notes, follow-up comments, or internal context"
                    className="w-full resize-none rounded-md border bg-white/90 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
                  />
                  <textarea
                    value={desiredOutcome}
                    onChange={(e) => setDesiredOutcome(e.target.value)}
                    rows={2}
                    placeholder="Desired outcome (what success looks like)"
                    className="w-full resize-none rounded-md border bg-white/90 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
                  />
                  <textarea
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    rows={2}
                    placeholder="Decision or follow-up note"
                    className="w-full resize-none rounded-md border bg-white/90 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
                  />
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Outcome score</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={outcomeScore}
                        onChange={(e) => setOutcomeScore(Math.max(0, Math.min(100, Number(e.target.value))))}
                        className="mt-1 w-full rounded-md border bg-white/90 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
                      />
                    </div>
                    <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
                      Score preview: {outcomeScore}%
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <CardTitle className="text-2xl">{title || 'Untitled Meeting'}</CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">{summary || 'No summary available yet.'}</p>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Desired outcome</p>
                      <p className="mt-2 text-sm text-slate-800 dark:text-slate-200">{desiredOutcome || 'No desired outcome set.'}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Decision</p>
                      <p className="mt-2 text-sm text-slate-800 dark:text-slate-200">{decision || 'No decision captured yet.'}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Notes</p>
                      <p className="mt-2 text-sm text-slate-800 dark:text-slate-200">{notes || 'No notes yet.'}</p>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/70">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Outcome score</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{outcomeScore}%</p>
                    </div>
                  </div>
                </>
              )}
            </div>
            {canManageSharing ? (
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Button size="sm" className="rounded-2xl" onClick={async () => {
                      setIsSaving(true);
                      try {
                        const res = await fetch('/api/meetings/update', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            meetingId: meeting.id,
                            title,
                            summary,
                            notes,
                            desired_outcome: desiredOutcome,
                            decision,
                            outcome_score: outcomeScore,
                          }),
                        });
                        const json = await res.json();
                        if (!res.ok || json.error) throw new Error(json.error || 'Save failed');
                        toast.success('Meeting updated');
                        setIsEditing(false);
                      } catch (err: unknown) {
                        toast.error(err instanceof Error ? err.message : 'Unable to save');
                      } finally {
                        setIsSaving(false);
                      }
                    }} disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-2xl" onClick={() => {
                      setIsEditing(false);
                      setTitle(meeting.title ?? '');
                      setSummary(meeting.summary ?? '');
                      setNotes(meeting.notes ?? '');
                      setDesiredOutcome(meeting.desired_outcome ?? '');
                      setDecision(meeting.decision ?? '');
                      setOutcomeScore(meeting.outcome_score ?? 0);
                    }}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="rounded-2xl" onClick={() => setIsEditing(true)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" className="rounded-2xl" onClick={handleDeleteMeeting} disabled={deleting}>
                      {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full bg-blue-100 text-blue-800">{isAdmin ? 'Admin overview' : 'Shared meeting'}</Badge>
            <Badge variant="outline" className="rounded-full">{actionItems.length} action items</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            {(['all', 'pending', 'done', 'overdue'] as const).map((tab) => (
              <Button
                key={tab}
                variant={filter === tab ? 'default' : 'outline'}
                size="sm"
                className="rounded-full"
                onClick={() => setFilter(tab)}
              >
                <Filter className="mr-2 h-4 w-4" />
                {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Button>
            ))}
          </div>

          <div className="space-y-3">
            {visibleItems.length > 0 ? (
              <AnimatePresence mode="popLayout">
                {visibleItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 dark:bg-slate-950/50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-base text-slate-900 dark:text-slate-100">{item.description}</p>
                          <Badge className={`rounded-full ${statusClass(item.status)}`}>{item.status}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          {item.assignee_email} • {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'No due date'}
                        </p>
                      </div>
                      {item.status !== 'done' ? (
                        <div className="flex gap-2">
                          <Button size="sm" className="rounded-2xl" onClick={() => handleDone(item.id)}>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as done
                          </Button>
                          {isAdmin ? (
                            <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => handleSendReminder(item.id)} disabled={sendingReminders.includes(item.id)}>
                              {sendingReminders.includes(item.id) ? 'Sending...' : 'Send reminder'}
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <Badge className="rounded-full bg-emerald-100 text-emerald-800">Completed</Badge>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center text-sm text-muted-foreground">
                <ListTodo className="mx-auto mb-3 h-6 w-6" />
                No action items for this view yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {canManageSharing ? (
        <Card className="rounded-3xl border-white/60 bg-white/80 shadow-sm backdrop-blur dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-xl">Share with teammates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MeetingShareForm
              meetingId={meeting.id}
              onShareSuccess={(email) =>
                setSharedMembers((members) =>
                  members.some((member) => member.email === email)
                    ? members
                    : [...members, { email, created_at: new Date().toISOString() }]
                )
              }
            />
            {sharedMembers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {sharedMembers.map((member) => (
                  <Badge key={member.email} variant="outline" className="rounded-full">
                    {member.email}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
