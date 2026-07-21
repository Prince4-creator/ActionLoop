'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { joinViaInviteLink } from '@/app/actions/invite-links';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/ui/icons';
import { BrandBadge } from '@/components/ui/brand-badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { isAdminUser } from '@/lib/auth';
import { acceptTeamInvite } from '@/app/actions/team-invites';

export default function LoginClient() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('inviteToken');
  const joinLinkToken = searchParams.get('joinLinkToken');
  const inviteEmail = searchParams.get('email');

  const [email, setEmail] = useState(() => (inviteEmail ? decodeURIComponent(inviteEmail) : ''));
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(() => Boolean(inviteToken || joinLinkToken));
  const supabase = createClient();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user?.id) {
          const cleanUsername = username.trim().toLowerCase();
          if (cleanUsername) {
            const { error: profileError } = await supabase
              .from('profiles')
              .upsert({ id: data.user.id, email, username: cleanUsername }, { onConflict: 'id' });

            if (profileError) {
              if (profileError.code === '23505' || profileError.message?.includes('duplicate')) {
                toast.error('That username is taken. You can set a different one later in Settings.');
              } else {
                console.error('Failed to save username:', profileError);
              }
            }
          }

          await fetch('/api/teams/ensure-default', { method: 'POST' });

          if (inviteToken) {
            try {
              const result = await acceptTeamInvite(inviteToken);
              toast.success('Welcome to your new team!');
              router.push(`/dashboard?teamJoined=${result.teamId}`);
              return;
            } catch (inviteError) {
              console.error('Failed to accept invite:', inviteError);
            }
          }

          if (joinLinkToken) {
            try {
              const result = await joinViaInviteLink(joinLinkToken);
              toast.success('Welcome to the team!');
              router.push(`/dashboard?teamJoined=${result.teamId}`);
              return;
            } catch (joinError) {
              console.error('Failed to join via link:', joinError);
              toast.error(joinError instanceof Error ? joinError.message : 'Unable to join team');
            }
          }
        }
        toast.success('Account created! Check your email to confirm if required.');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user?.id) {
          const isAdmin = isAdminUser(data.user);
          if (isAdmin) {
            await supabase.auth.signOut();
            toast.error('Admin accounts must sign in through the admin login page.');
            router.push('/admin/login');
            return;
          }

          await fetch('/api/teams/ensure-default', { method: 'POST' });

          if (inviteToken) {
            try {
              const result = await acceptTeamInvite(inviteToken);
              toast.success('Joined team successfully!');
              router.push(`/dashboard?teamJoined=${result.teamId}`);
              return;
            } catch (inviteError) {
              console.error('Failed to accept invite:', inviteError);
            }
          }

          if (joinLinkToken) {
            try {
              const result = await joinViaInviteLink(joinLinkToken);
              toast.success('Joined team successfully!');
              router.push(`/dashboard?teamJoined=${result.teamId}`);
              return;
            } catch (joinError) {
              console.error('Failed to join via link:', joinError);
              toast.error(joinError instanceof Error ? joinError.message : 'Unable to join team');
            }
          }
        }
        toast.success('Signed in!');
        router.refresh();
        router.push('/dashboard');
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://actionloop-orpin.vercel.app';
      const redirectUrl = `${origin}/auth/callback?next=/dashboard`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
      setIsLoading(false);
    }
  };

  const isLinkedJoin = Boolean(inviteToken || joinLinkToken);

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-slate-50 text-slate-900 py-16 px-4 dark:bg-slate-950 dark:text-slate-100">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-100 to-slate-50 opacity-100 dark:from-blue-950 dark:via-slate-900 dark:to-purple-950" />
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.1, 1], x: [0, 40, -20, 0], y: [0, -20, 40, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-1/2 left-1/4 h-[32rem] w-[32rem] rounded-full bg-slate-200/70 blur-3xl dark:bg-white/10"
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], x: [0, -48, 24, 0], y: [0, 46, -24, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-1/2 right-1/4 h-[28rem] w-[28rem] rounded-full bg-slate-200/70 blur-3xl dark:bg-white/10"
        />
      </div>
      <div className="relative z-10 w-full">
        <div className="flex min-h-full items-center justify-center px-4">
          <div className="w-full max-w-md space-y-8">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-center space-y-3 px-4"
            >
              <div className="flex justify-center mb-4">
                <BrandBadge className="h-16 w-16 rounded-[1.35rem] border-white/30" />
              </div>
              <h1 className="text-3xl lg:text-4xl font-semibold text-slate-900 tracking-tight drop-shadow-[0_10px_40px_rgba(0,0,0,0.08)] dark:text-white">
                ActionLoop
              </h1>
              <p className="text-slate-600 text-sm lg:text-base font-medium leading-7 dark:text-slate-300">
                Intelligent Meeting Management
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <Card className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.25)] dark:border-white/15 dark:bg-slate-950 dark:shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)]">
                <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/70 pointer-events-none" />
                  <CardHeader className="space-y-1 text-center relative z-10 px-6 pt-8">
                  <CardTitle className="text-2xl lg:text-3xl font-semibold text-slate-900 tracking-tight dark:text-white">
                    {isLinkedJoin && isSignUp ? 'Join your team' : isSignUp ? 'Get started' : 'Welcome back'}
                  </CardTitle>
                  <CardDescription className="text-slate-600 text-sm lg:text-base font-medium dark:text-slate-300">
                    {isLinkedJoin && isSignUp ? 'Accept your team invitation to collaborate' : isSignUp ? 'Start capturing meetings today' : 'Sign in to your ActionLoop account'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 relative z-10 px-6 pb-8 pt-4">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-slate-700 font-semibold uppercase text-[0.65rem] lg:text-sm tracking-[0.2em] dark:text-slate-200">Email address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="rounded-2xl bg-slate-50 text-slate-900 placeholder:text-slate-500 focus:bg-white focus:border-slate-300 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-slate-700 font-semibold uppercase text-[0.65rem] lg:text-sm tracking-[0.2em] dark:text-slate-200">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="rounded-2xl bg-slate-50 text-slate-900 placeholder:text-slate-500 focus:bg-white focus:border-slate-300 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-slate-500"
                      />
                    </div>
                    {isSignUp ? (
                      <div className="space-y-2">
                        <Label htmlFor="username" className="text-slate-700 font-semibold uppercase text-[0.65rem] lg:text-sm tracking-[0.2em] dark:text-slate-200">Username</Label>
                        <Input
                          id="username"
                          placeholder="bob"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                          className="rounded-2xl bg-slate-50 text-slate-900 placeholder:text-slate-500 focus:bg-white focus:border-slate-300 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-slate-500"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">Say this name in meetings to assign tasks to yourself.</p>
                      </div>
                    ) : null}
                    <Button
                      type="submit"
                      className="w-full h-13 rounded-xl bg-blue-600 text-white hover:bg-blue-500 focus-visible:ring-blue-300 font-semibold text-sm shadow-lg shadow-blue-600/20 transition-all"
                      disabled={isLoading || !email || !password || (isSignUp && !username.trim())}
                    >
                      {isLoading && <Icons.spinner className="mr-2 h-5 w-5 animate-spin" />}
                      {isSignUp ? 'Create account' : 'Sign in'}
                    </Button>
                  </form>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setIsSignUp((value) => !value)}
                      className="text-sm font-semibold text-blue-600 transition hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                    </button>
                  </div>
                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-slate-50 px-3 text-slate-500 font-semibold shadow-sm dark:bg-slate-950/80 dark:text-slate-400">
                        Or continue with
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    className="w-full h-13 rounded-xl bg-white hover:bg-blue-50 text-slate-900 font-bold text-sm transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 22c2.94 0 5.42-1.01 7.22-2.69l-3.57-2.77c-.99.67-2.28 1.07-3.65 1.07-2.8 0-5.16-1.88-6.01-4.41H2.83v2.77C4.6 19.83 8.04 22 12 22z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.99 13.86a6.998 6.998 0 010-3.72V7.37H2.83a10.98 10.98 0 000 9.26l3.16-2.77z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 7.5c1.62 0 3.09.56 4.24 1.66l3.18-3.17C17.41 3.2 14.93 2 12 2 8.04 2 4.6 4.17 2.83 7.37l3.16 2.77C6.84 9.38 9.2 7.5 12 7.5z"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}