'use client';

import { useState, useTransition } from 'react';
import { shareMeetingWithUser } from '@/app/actions/meetings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function MeetingShareForm({
  meetingId,
  onShareSuccess,
}: {
  meetingId: string;
  onShareSuccess?: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('meeting_id', meetingId);
        formData.append('email', trimmedEmail);

        const result = await shareMeetingWithUser(formData);
        if (result?.success) {
          toast.success('Teammate added');
          onShareSuccess?.(trimmedEmail);
          setEmail('');
        } else {
          throw new Error('Failed to share meeting');
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : 'Failed to share meeting');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <Input
        type="email"
        placeholder="teammate@company.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="rounded-xl"
      />
      <Button type="submit" disabled={isPending || !email.trim()} className="rounded-xl">
        {isPending ? 'Sharing...' : 'Share'}
      </Button>
    </form>
  );
}