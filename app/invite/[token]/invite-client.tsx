'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { acceptTeamInvite, getInviteDetails } from '@/app/actions/team-invites';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

interface InviteClientProps {
  token: string;
}

export function InviteClient({ token }: InviteClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inviteDetails, setInviteDetails] = useState<{
    email: string;
    teamName: string;
    teamId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function checkAuthAndLoadInvite() {
      try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        setIsAuthenticated(!!user);

        // Get invite details
        const details = await getInviteDetails(token);
        setInviteDetails(details);

        // If authenticated and email matches, accept immediately
        if (user && user.email?.toLowerCase() === details.email.toLowerCase()) {
          try {
            const result = await acceptTeamInvite(token);
            router.push(`/dashboard?teamJoined=${result.teamId}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to accept invite');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invite');
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndLoadInvite();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-4">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Invite Invalid</h1>
            <p className="mt-2 text-red-600">{error}</p>
            <Link href="/login">
              <Button className="mt-4 w-full">Back to Login</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!inviteDetails) {
    return null;
  }

  // User is authenticated but email doesn't match
  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Email Mismatch</h1>
            <p className="mt-2 text-sm">
              This invite is for <strong>{inviteDetails.email}</strong>, but you're signed in with a different email.
            </p>
            <p className="mt-4 text-sm text-gray-600">
              Please sign out and log in with the correct email, or create a new account.
            </p>
            <Link href="/login">
              <Button className="mt-6 w-full">Back to Login</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // User not authenticated - show signup prompt
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Join {inviteDetails.teamName}</h1>
          <p className="mt-2 text-sm text-gray-600">
            You've been invited to join a team on ActionLoop
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <p className="text-sm font-medium">Invite email:</p>
              <p className="mt-1 font-mono text-sm">{inviteDetails.email}</p>
            </div>

            <Link href={`/login?inviteToken=${token}&email=${encodeURIComponent(inviteDetails.email)}`}>
              <Button className="w-full">Sign Up or Log In</Button>
            </Link>

            <p className="text-xs text-gray-500">
              After signing up or logging in with this email, you'll be automatically added to the team.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
