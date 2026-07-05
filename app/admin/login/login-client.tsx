'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/ui/icons';
import { BrandBadge } from '@/components/ui/brand-badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { isAdminUser } from '@/lib/auth';

export default function AdminLoginClient() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requiresTotp, setRequiresTotp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user?.id) {
        const isAdmin = isAdminUser(data.user);
        if (!isAdmin) {
          toast.error('This account is not marked as an admin.');
          return;
        }

        const totpResponse = await fetch('/api/admin/totp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: totpCode }),
        });

        const totpPayload = await totpResponse.json().catch(() => ({ valid: false, required: true }));

        if (totpPayload.required && !totpCode) {
          setRequiresTotp(true);
          toast.error('Enter your authenticator code to continue.');
          return;
        }

        if (totpPayload.required && !totpPayload.valid) {
          setRequiresTotp(true);
          toast.error('Enter a valid authenticator code to continue.');
          return;
        }

        if (!totpResponse.ok) {
          setRequiresTotp(true);
          toast.error(totpPayload.error || 'Unable to verify authenticator code.');
          return;
        }

        await fetch('/api/teams/ensure-default', { method: 'POST' });
        toast.success('Admin access confirmed');
        router.replace('/admin');
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://actionloop-orpin.vercel.app';
      const redirectUrl = `${origin}/auth/callback?next=/admin`;

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

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-slate-50 px-4 py-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-100 to-slate-50 opacity-100 dark:from-blue-950 dark:via-slate-900 dark:to-purple-950" />
      <div className="relative z-10 w-full">
        <div className="flex min-h-full items-center justify-center px-4">
          <div className="w-full max-w-md space-y-8">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-3 px-4 text-center"
            >
              <div className="mb-4 flex justify-center">
                <BrandBadge className="h-16 w-16 rounded-[1.35rem] border-white/30" />
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900 drop-shadow-[0_10px_40px_rgba(0,0,0,0.08)] dark:text-white">
                Admin access
              </h1>
              <p className="text-base font-medium leading-7 text-slate-600 dark:text-slate-300">
                Use this page for workspace administrator sign-in.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <Card className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.25)] dark:border-white/15 dark:bg-slate-950 dark:shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)]">
                <div className="pointer-events-none absolute inset-0 bg-white/60 dark:bg-slate-950/70" />
                <CardHeader className="relative z-10 space-y-1 px-6 pt-8 text-center">
                  <CardTitle className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    Workspace admin
                  </CardTitle>
                  <CardDescription className="text-base font-medium text-slate-600 dark:text-slate-300">
                    Sign in with your admin account to open the control center.
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative z-10 space-y-6 px-6 pb-8 pt-4">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="admin-email" className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">
                        Email address
                      </Label>
                      <Input
                        id="admin-email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="rounded-2xl bg-slate-50 text-slate-900 placeholder:text-slate-500 focus:border-slate-300 focus:bg-white dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-password" className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">
                        Password
                      </Label>
                      <Input
                        id="admin-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="rounded-2xl bg-slate-50 text-slate-900 placeholder:text-slate-500 focus:border-slate-300 focus:bg-white dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-slate-500"
                      />
                    </div>
                    {requiresTotp ? (
                      <div className="space-y-2">
                        <Label htmlFor="totp-code" className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">
                          Authenticator code
                        </Label>
                        <Input
                          id="totp-code"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="123456"
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value)}
                          className="rounded-2xl bg-slate-50 text-slate-900 placeholder:text-slate-500 focus:border-slate-300 focus:bg-white dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-slate-500"
                        />
                      </div>
                    ) : null}

                    <Button
                      type="submit"
                      className="h-13 w-full rounded-xl bg-blue-600 text-base font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 focus-visible:ring-blue-300"
                      disabled={isLoading || !email || !password || (requiresTotp && totpCode.length < 6)}
                    >
                      {isLoading && <Icons.spinner className="mr-2 h-5 w-5 animate-spin" />}
                      {requiresTotp ? 'Verify and continue' : 'Continue to admin'}
                    </Button>
                  </form>

                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-slate-50 px-3 font-semibold text-slate-500 shadow-sm dark:bg-slate-950/80 dark:text-slate-400">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-white text-base font-bold text-slate-900 shadow-lg transition-all hover:bg-blue-50 hover:shadow-xl disabled:opacity-50"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 22c2.94 0 5.42-1.01 7.22-2.69l-3.57-2.77c-.99.67-2.28 1.07-3.65 1.07-2.8 0-5.16-1.88-6.01-4.41H2.83v2.77C4.6 19.83 8.04 22 12 22z" />
                      <path fill="#FBBC05" d="M5.99 13.86a6.998 6.998 0 010-3.72V7.37H2.83a10.98 10.98 0 000 9.26l3.16-2.77z" />
                      <path fill="#EA4335" d="M12 7.5c1.62 0 3.09.56 4.24 1.66l3.18-3.17C17.41 3.2 14.93 2 12 2 8.04 2 4.6 4.17 2.83 7.37l3.16 2.77C6.84 9.38 9.2 7.5 12 7.5z" />
                    </svg>
                    Continue with Google
                  </Button>

                  <div className="text-center text-sm">
                    <Link href="/login" className="font-semibold text-blue-600 transition hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                      Back to regular sign-in
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
