'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ProfileSettingsForm({ initialUsername }: { initialUsername: string }) {
  const [username, setUsername] = useState(initialUsername);
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  const handleSave = async () => {
    const trimmed = username.trim();
    if (trimmed.length < 2) {
      toast.error('Username must be at least 2 characters');
      return;
    }
    if (trimmed.length > 40) {
      toast.error('Username must be 40 characters or fewer');
      return;
    }

    setIsSaving(true);
    try {
      // Writes to the current user's own auth.users.raw_user_meta_data.
      // No RLS, no service-role key, no new table — Supabase always lets a
      // signed-in user update their own metadata this way.
      const { error } = await supabase.auth.updateUser({
        data: { username: trimmed },
      });
      if (error) throw error;
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Choose a display name"
          className="max-w-sm rounded-xl"
        />
        <p className="text-xs text-muted-foreground">
          Shown in the sidebar and anywhere your name appears instead of your email.
        </p>
      </div>
      <Button onClick={handleSave} disabled={isSaving || !username.trim()} className="rounded-xl">
        {isSaving ? 'Saving...' : 'Save profile'}
      </Button>
    </div>
  );
}