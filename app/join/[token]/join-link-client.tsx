'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getInviteLinkDetails, joinViaInviteLink } from '@/app/actions/invite-links';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export function JoinLinkClient({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [joining, setJoining] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setIsAuthenticated(!!user);

        const details = await getInviteLinkDetails(token);
        setTeamName(details.teamName);

        if (user) {
          setJoining(true);
          const result = await joinViaInviteLink(token);
          router.push(`/dashboard?teamJoined=${result.teamId}`);
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invite link');
      } finally {
        setLoading(false);
        setJoining(false);
      }
    }
    load();
  }, [token]);

  if (loading || joining) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-4">{joining ? 'Joining team...' : 'Loading invite...'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Invite link invalid</h1>
            <p className="mt-2 text-red-600">{error}</p>
            <Link href="/login">
              <Button className="mt-4 w-full">Back to login</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Not authenticated — send to signup, carrying the invite link token so
  // we can auto-join right after they create an account.
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Join {teamName}</h1>
          <p className="mt-2 text-sm text-gray-600">
            You've been invited to join this team on ActionLoop. Anyone with this link can join — sign up or log in to continue.
          </p>
          <div className="mt-6 space-y-4">
            <Link href={`/login?joinLinkToken=${token}`}>
              <Button className="w-full">Sign up or log in</Button>
            </Link>
            <p className="text-xs text-gray-500">
              After signing up or logging in, you'll be automatically added to the team.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}