import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Mail, ShieldCheck } from 'lucide-react';
import SettingsClient from './settings-client';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const createdAt = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown';
  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('nudge_preference, slack_access_token, slack_channel_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const preference = settingsError ? 'email' : ((settings?.nudge_preference as string | undefined) || 'email');
  const slackConnected = Boolean(!settingsError && settings?.slack_access_token);
  const slackChannel = (settings?.slack_channel_id as string | undefined) || '';

  return (
    <AppShell
      user={user}
      currentPath="/settings"
      title="Settings"
      description="Manage your account and preferences"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Card className="rounded-3xl border-white/60 bg-white/70 shadow-sm backdrop-blur dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-xl">Account details</CardTitle>
            <CardDescription>Keep your workspace profile up to date.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="rounded-full bg-emerald-100 text-emerald-800">Active account</Badge>
              <Badge variant="outline" className="rounded-full">Workspace member</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 dark:bg-slate-950/50">
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" /> Email
                </div>
                <p className="font-medium">{user.email}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 dark:bg-slate-950/50">
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" /> Joined
                </div>
                <p className="font-medium">{createdAt}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/60 bg-white/70 shadow-sm backdrop-blur dark:bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-xl">Preferences</CardTitle>
            <CardDescription>Control how nudges reach your team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SettingsClient initialPreference={preference} initialSlackConnected={slackConnected} initialSlackChannel={slackChannel} />
            <Button variant="outline" className="rounded-2xl">
              Reset password
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
