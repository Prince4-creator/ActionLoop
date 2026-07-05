'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { inviteTeamMember, getTeamInvites, revokeTeamInvite } from '@/app/actions/team-invites';
import { Copy, Mail, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getAppUrl } from '@/lib/app-url';

type TeamInvite = {
  id: string;
  email: string;
  token: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  created_at: string;
  accepted_at: string | null;
  expires_at: string;
};

type TeamMember = {
  user_id: string;
  email: string | null;
  role: string;
  joined_at: string | null;
};

interface TeamSettingsClientProps {
  teamId: string;
  teamName: string;
  teamMembers: TeamMember[];
  userRole: string;
}

export default function TeamSettingsClient({
  teamId,
  teamName,
  teamMembers,
  userRole,
}: TeamSettingsClientProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const isOwner = userRole === 'owner';

  // Fetch invites on load
  useEffect(() => {
    fetchInvites();
  }, []);

  const fetchInvites = async () => {
    try {
      setIsFetching(true);
      const result = await getTeamInvites(teamId);
      setInvites(result);
    } catch (error) {
      console.error('Failed to fetch invites:', error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setIsLoading(true);
    try {
      await inviteTeamMember(teamId, inviteEmail);
      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
      await fetchInvites();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send invite';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    if (!confirm('Are you sure you want to revoke this invite?')) {
      return;
    }

    try {
      await revokeTeamInvite(inviteId);
      toast.success('Invite revoked');
      await fetchInvites();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to revoke invite';
      toast.error(message);
    }
  };

  const handleCopyInviteLink = async (token: string) => {
    try {
      const inviteUrl = `${getAppUrl()}/invite/${token}`;
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('Invite link copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy invite link');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 rounded-full">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Accepted
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-amber-100 text-amber-800 rounded-full">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case 'revoked':
        return <Badge className="bg-slate-100 text-slate-800 rounded-full">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      {/* Team Members Section */}
      <Card className="rounded-3xl border-white/60 bg-white/80 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl">Team Members</CardTitle>
          <CardDescription>Manage your team workspace members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50">
            <div className="divide-y">
              {teamMembers.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-slate-900">{member.email || 'Unknown'}</p>
                    <p className="text-sm text-slate-500">
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)} •{' '}
                      {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : 'Recently'}
                    </p>
                  </div>
                  <Badge className="rounded-full bg-blue-100 text-blue-800">
                    {member.role === 'owner' ? '👑 Owner' : 'Member'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invites Section */}
      {isOwner && (
        <>
          <Card className="rounded-3xl border-white/60 bg-white/80 shadow-sm backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl">Send Invitations</CardTitle>
              <CardDescription>Invite new team members to join {teamName}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Team member email</Label>
                  <div className="flex gap-2">
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      disabled={isLoading}
                      className="rounded-xl"
                    />
                    <Button
                      type="submit"
                      disabled={isLoading || !inviteEmail.trim()}
                      className="rounded-xl"
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {isLoading ? 'Sending...' : 'Send Invite'}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Pending Invites */}
          <Card className="rounded-3xl border-white/60 bg-white/80 shadow-sm backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl">Pending Invitations</CardTitle>
              <CardDescription>
                {isFetching
                  ? 'Loading invites...'
                  : `${invites.filter((i) => i.status === 'pending').length} pending`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isFetching ? (
                <p className="text-slate-500">Loading invitations...</p>
              ) : invites.length === 0 ? (
                <p className="text-slate-500">No invitations yet. Start by inviting team members above.</p>
              ) : (
                <div className="space-y-3">
                  {invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900">{invite.email}</p>
                        <p className="text-sm text-slate-500">
                          {invite.status === 'pending'
                            ? `Expires ${new Date(invite.expires_at).toLocaleDateString()}`
                            : invite.status === 'accepted'
                              ? `Accepted on ${new Date(invite.accepted_at!).toLocaleDateString()}`
                              : invite.status}
                        </p>
                        {invite.status === 'pending' && (
                          <p className="mt-2 break-all text-xs text-slate-500">
                            {getAppUrl()}/invite/{invite.token}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(invite.status)}
                        {invite.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyInviteLink(invite.token)}
                              className="h-8 w-8 p-0"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevoke(invite.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!isOwner && (
        <Card className="rounded-3xl border-white/60 bg-white/80 shadow-sm backdrop-blur">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">
              Only team owners can manage invitations. Ask a team owner to invite new members.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
