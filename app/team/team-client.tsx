'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Crown, MailPlus, Sparkles, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function TeamClient({
  team,
  members,
  currentUserId,
  currentUserEmail,
}: {
  team: { id: string; name: string; owner_id: string; created_at: string | null } | null;
  members: Array<{
    user_id: string;
    role: string;
    joined_at: string | null;
    email: string | null;
    total: number;
    done: number;
    score: number;
  }>;
  currentUserId: string;
  currentUserEmail: string | null | undefined;
}) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const topPerformer = members[0];
  const currentUserScore = members.find((member) => member.user_id === currentUserId)?.score ?? 0;

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team?.id, email: inviteEmail.trim() }),
      });
      const payload = await res.json();
      if (!res.ok || payload.error) throw new Error(payload.error || 'Invite failed');
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invite failed');
    } finally {
      setIsInviting(false);
    }
  };

  const sortedMembers = useMemo(() => members, [members]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Card className="rounded-3xl border-white/60 bg-white/80 shadow-sm backdrop-blur dark:bg-slate-900/70">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">{team?.name || 'Your team'}</CardTitle>
              <CardDescription>Drive momentum together and celebrate your top closer this month.</CardDescription>
            </div>
            <Badge className="rounded-full bg-amber-100 text-amber-800">{sortedMembers.length} members</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <Crown className="h-4 w-4" /> Closer of the month
              </div>
              {topPerformer ? (
                <p className="mt-2 text-lg font-semibold text-slate-900">{topPerformer.email || topPerformer.user_id}</p>
              ) : (
                <p className="mt-2 text-sm text-slate-600">No activity yet. Start closing actions to claim the crown.</p>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Sparkles className="h-4 w-4" /> Your score
              </div>
              <p className="mt-2 text-lg font-semibold text-slate-900">{currentUserScore}% monthly closer score</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row">
            <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Invite teammate by email" className="rounded-2xl" />
            <Button onClick={handleInvite} disabled={isInviting} className="rounded-2xl">
              <MailPlus className="mr-2 h-4 w-4" /> Invite
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-white/60 bg-white/80 shadow-sm backdrop-blur dark:bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-xl">Leaderboard</CardTitle>
          <CardDescription>Momentum is visible when every action closes with purpose.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <AnimatePresence mode="popLayout">
            {sortedMembers.map((member, index) => (
              <motion.div
                key={member.user_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: index * 0.05 }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{member.email || member.user_id}</p>
                      {index === 0 ? <Crown className="h-4 w-4 text-amber-500" /> : null}
                    </div>
                    <p className="text-sm text-slate-500">{member.role} • {member.done}/{member.total} completed</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="rounded-full bg-emerald-100 text-emerald-800">{member.score}%</Badge>
                  {currentUserEmail && member.email?.toLowerCase() === currentUserEmail.toLowerCase() ? <Badge className="rounded-full bg-slate-900 text-white">You</Badge> : null}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
