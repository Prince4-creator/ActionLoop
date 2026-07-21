'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { createClient } from '@/utils/supabase/client';
import { UserRound, TriangleAlert } from 'lucide-react';

export default function ProfileSettingsClient({
  initialFullName,
  userEmail,
}: {
  initialFullName: string;
  userEmail: string | null | undefined;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState(initialFullName);
  const [isSavingName, setIsSavingName] = useState(false);

  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSaveName = async () => {
    setIsSavingName(true);
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName }),
      });
      const payload = await res.json();
      if (!res.ok || payload.error) throw new Error(payload.error || 'Unable to save profile');
      toast.success('Profile updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save profile');
    } finally {
      setIsSavingName(false);
    }
  };

  const expectedConfirm = userEmail ?? '';
  const canDelete = confirmText.trim().toLowerCase() === expectedConfirm.toLowerCase() && expectedConfirm !== '';

  const handleDeleteAccount = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/settings/delete-account', { method: 'POST' });
      const payload = await res.json();
      if (!res.ok || payload.error) throw new Error(payload.error || 'Unable to delete account');

      toast.success('Account deleted');
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Editable name */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-start gap-3">
          <UserRound className="mt-0.5 h-5 w-5 text-slate-700" />
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Display name</p>
            <p className="text-sm text-slate-600">Shown to teammates on meetings and the leaderboard.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="max-w-sm"
                maxLength={120}
              />
              <Button onClick={handleSaveName} disabled={isSavingName} size="sm" className="rounded-full">
                {isSavingName ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Danger zone */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-red-200 bg-red-50/70 p-4"
      >
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 text-red-600" />
          <div className="flex-1">
            <p className="font-semibold text-red-900">Delete account</p>
            <p className="text-sm text-red-700">
              Permanently deletes your account and access. If you own a team with other members, transfer
              ownership or remove them first — this action can't be undone.
            </p>

            {!showConfirm ? (
              <Button
                variant="destructive"
                size="sm"
                className="mt-3 rounded-full"
                onClick={() => setShowConfirm(true)}
              >
                Delete my account
              </Button>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-red-800">
                  Type <span className="font-mono font-semibold">{expectedConfirm}</span> to confirm.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={expectedConfirm}
                    className="max-w-sm border-red-300"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-full"
                      disabled={!canDelete || isDeleting}
                      onClick={handleDeleteAccount}
                    >
                      {isDeleting ? 'Deleting…' : 'Permanently delete'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => {
                        setShowConfirm(false);
                        setConfirmText('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}