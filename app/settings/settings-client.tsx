'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { BellRing, MessageSquareMore, ShieldCheck } from 'lucide-react';

export default function SettingsClient({
  initialPreference,
  initialSlackConnected,
  initialSlackChannel,
}: {
  initialPreference: string;
  initialSlackConnected: boolean;
  initialSlackChannel?: string;
}) {
  const [preference, setPreference] = useState(initialPreference);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSavingChannel, setIsSavingChannel] = useState(false);
  const [slackChannel, setSlackChannel] = useState(initialSlackChannel ?? '');

  useEffect(() => {
    setSlackChannel(initialSlackChannel ?? '');
  }, [initialSlackChannel]);

  const handleConnectSlack = async () => {
    setIsConnecting(true);
    try {
      const res = await fetch('/api/auth/slack/connect');
      const payload = await res.json();
      if (!res.ok || payload.error) throw new Error(payload.error || 'Unable to connect Slack');
      window.location.href = payload.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to connect Slack');
      setIsConnecting(false);
    }
  };

  const handlePreferenceChange = async (value: string) => {
    setPreference(value);
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nudge_preference: value }),
      });
      const payload = await res.json();
      if (!res.ok || payload.error) throw new Error(payload.error || 'Unable to update preference');
      toast.success('Nudge preference updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update preference');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSlackChannel = async () => {
    const channelValue = slackChannel.trim();
    setIsSavingChannel(true);
    try {
      const res = await fetch('/api/settings/slack-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slack_channel_id: channelValue }),
      });
      const payload = await res.json();
      if (!res.ok || payload.error) throw new Error(payload.error || 'Unable to save Slack channel');
      toast.success('Slack channel saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save Slack channel');
    } finally {
      setIsSavingChannel(false);
    }
  };

  const handleSendTestMessage = async () => {
    const channelValue = slackChannel.trim();
    if (!channelValue) {
      toast.error('Enter a Slack channel ID like C0123ABC or a public channel such as #general.');
      return;
    }

    setIsSendingTest(true);
    try {
      const res = await fetch('/api/auth/slack/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: channelValue, text: 'ActionLoop test message ✅' }),
      });
      const payload = await res.json();
      if (!res.ok || payload.error) throw new Error(payload.error || 'Unable to send test message');
      await handleSaveSlackChannel();
      toast.success('Test message sent to Slack');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send test message');
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-start gap-3">
          <BellRing className="mt-0.5 h-5 w-5 text-slate-700" />
          <div>
            <p className="font-semibold text-slate-900">Nudge delivery</p>
            <p className="text-sm text-slate-600">Choose how reminders reach your team.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {['email', 'slack', 'both'].map((value) => (
            <Button
              key={value}
              variant={preference === value ? 'default' : 'outline'}
              className="rounded-full capitalize"
              onClick={() => handlePreferenceChange(value)}
              disabled={isSaving}
            >
              {value}
            </Button>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <MessageSquareMore className="mt-0.5 h-5 w-5 text-slate-700" />
            <div>
              <p className="font-semibold text-slate-900">Slack integration</p>
              <p className="text-sm text-slate-600">Send nudges into a team channel or workspace stream.</p>
            </div>
          </div>
          <Button onClick={handleConnectSlack} disabled={isConnecting} className="rounded-2xl">
            {initialSlackConnected ? 'Reconnect Slack' : 'Connect Slack'}
          </Button>
        </div>
        {initialSlackConnected ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-emerald-700">Slack is connected for your account.</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={slackChannel}
                onChange={(event) => setSlackChannel(event.target.value)}
                placeholder="Channel ID or #channel"
                className="max-w-sm"
              />
              <div className="flex gap-2">
                <Button onClick={handleSaveSlackChannel} disabled={isSavingChannel} variant="outline" size="sm" className="rounded-full">
                  {isSavingChannel ? 'Saving…' : 'Save channel'}
                </Button>
                <Button onClick={handleSendTestMessage} disabled={isSendingTest} variant="outline" size="sm" className="rounded-full">
                  {isSendingTest ? 'Sending…' : 'Send test message'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-500">Use a channel ID such as C0123ABC or a public channel name such as #general. The app must be invited to that channel.</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Slack is not connected yet.</p>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-700" />
          <div>
            <p className="font-semibold text-slate-900">Workspace controls</p>
            <p className="text-sm text-slate-600">Your preferences update instantly for the current team experience.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
