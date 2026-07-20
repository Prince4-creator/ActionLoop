'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ShieldCheck,
  Users,
  Inbox,
  Building2,
  CalendarClock,
  ListChecks,
  AlertTriangle,
  Search,
  ArrowUpRight,
  Crown,
  KeyRound,
  Activity,
  CheckSquare,
  Square,
  Download,
  ChevronDown,
  Flame,
  ShieldAlert,
} from 'lucide-react';
import SetupTotpClient from './setup-totp/setup-totp-client';
import { describeAuditAction, type AuditLogEntry } from '@/lib/audit';

type Profile = {
  id: string;
  email: string | null;
  role: string | null;
  updated_at: string | null;
};

type Stats = {
  totalUsers: number;
  adminCount: number;
  meetingRequests: number | null;
  teams: number;
  meetings: number;
  actionItems: number;
  pendingActionItems: number;
};

type SortKey = 'email' | 'role' | 'updated_at';

const SORT_LABELS: Record<SortKey, string> = {
  email: 'Sort: Email',
  role: 'Sort: Role',
  updated_at: 'Sort: Recently updated',
};

function initialsFor(email: string | null) {
  if (!email) return 'U';
  const name = email.split('@')[0];
  const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'U'
  );
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

// Dependency-free horizontal bar distribution — no chart library needed.
function DistributionBars({ stats }: { stats: Stats }) {
  const rows = [
    { label: 'Meetings', value: stats.meetings, color: 'oklch(0.72 0.16 300)' },
    { label: 'Action items', value: stats.actionItems, color: 'oklch(0.75 0.14 260)' },
    { label: 'Pending actions', value: stats.pendingActionItems, color: 'oklch(0.78 0.14 85)' },
    { label: 'Teams', value: stats.teams, color: 'oklch(0.7 0.13 200)' },
  ];
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{row.label}</span>
            <span className="font-semibold text-foreground">{row.value}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ backgroundColor: row.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboardClient({
  adminEmail,
  profiles,
  errorMessage,
  schemaError,
  stats,
  auditLog,
}: {
  adminEmail: string;
  profiles: Profile[];
  errorMessage: string | null;
  schemaError: boolean;
  stats: Stats;
  auditLog: AuditLogEntry[];
}) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('email');
  const [pendingRoleId, setPendingRoleId] = useState<string | null>(null);
  const [localProfiles, setLocalProfiles] = useState(profiles);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? localProfiles
      : localProfiles.filter(
          (p) =>
            p.email?.toLowerCase().includes(q) ||
            p.role?.toLowerCase().includes(q)
        );

    return [...list].sort((a, b) => {
      if (sortBy === 'email') return (a.email ?? '').localeCompare(b.email ?? '');
      if (sortBy === 'role') return (a.role ?? '').localeCompare(b.role ?? '');
      return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
    });
  }, [localProfiles, query, sortBy]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    setSelectedIds((current) => {
      if (allFilteredSelected) return new Set();
      const next = new Set(current);
      filtered.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleRole = async (profile: Profile) => {
    const nextRole = profile.role === 'admin' ? '' : 'admin';
    setPendingRoleId(profile.id);

    const previous = localProfiles;
    setLocalProfiles((current) =>
      current.map((p) => (p.id === profile.id ? { ...p, role: nextRole || 'member' } : p))
    );

    try {
      const res = await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: profile.id, role: nextRole }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error || 'Update failed');
      toast.success(nextRole ? `${profile.email} is now an admin` : `${profile.email} is now a member`);
    } catch (err) {
      setLocalProfiles(previous);
      toast.error(err instanceof Error ? err.message : 'Unable to update role');
    } finally {
      setPendingRoleId(null);
    }
  };

  const handleBulkRoleChange = async (role: 'admin' | '') => {
    if (!selectedIds.size) return;
    const ids = Array.from(selectedIds);
    setBulkPending(true);

    const previous = localProfiles;
    setLocalProfiles((current) =>
      current.map((p) => (ids.includes(p.id) ? { ...p, role: role || 'member' } : p))
    );

    try {
      const res = await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, role }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error || 'Bulk update failed');
      toast.success(`${ids.length} user${ids.length === 1 ? '' : 's'} updated`);
      setSelectedIds(new Set());
    } catch (err) {
      setLocalProfiles(previous);
      toast.error(err instanceof Error ? err.message : 'Unable to update selected users');
    } finally {
      setBulkPending(false);
    }
  };

  const handleExportUsers = () => {
    const header = ['Email', 'Role', 'Updated At'];
    const rows = filtered.map((p) => [p.email ?? '', p.role || 'member', p.updated_at ?? '']);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `actionloop-users-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Users exported');
  };

  const statCards = [
    { label: 'Total users', value: stats.totalUsers, icon: Users, accent: 'from-violet-500 to-fuchsia-600' },
    { label: 'Admins', value: stats.adminCount, icon: Crown, accent: 'from-amber-400 to-yellow-500' },
    {
      label: 'Meeting requests',
      value: stats.meetingRequests ?? '—',
      icon: Inbox,
      accent: 'from-cyan-500 to-blue-600',
    },
    { label: 'Teams', value: stats.teams, icon: Building2, accent: 'from-emerald-500 to-teal-600' },
    { label: 'Meetings', value: stats.meetings, icon: CalendarClock, accent: 'from-fuchsia-500 to-pink-600' },
    {
      label: 'Pending actions',
      value: stats.pendingActionItems,
      icon: ListChecks,
      accent: 'from-rose-500 to-red-600',
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {/* Hero — violet/gold, deliberately distinct from the member dashboard */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-white shadow-2xl sm:p-8"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="admin-accent-rule rounded-full border border-white/20 bg-white/10 text-white backdrop-blur">
              <ShieldCheck className="mr-1 h-3 w-3" /> Admin control center
            </Badge>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              Workspace command center
            </h1>
            <p className="mt-2 max-w-xl text-sm text-indigo-100/80">
              Signed in as <span className="font-medium text-white">{adminEmail}</span>. Manage users, review
              requests, and monitor the workspace from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/requests">
              <Button className="rounded-2xl border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20">
                <Inbox className="mr-2 h-4 w-4" /> Requests
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/admin/zombie-tasks">
              <Button className="rounded-2xl border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20">
                <Flame className="mr-2 h-4 w-4" /> Zombie tasks
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/team">
              <Button variant="outline" className="rounded-2xl border-white/30 bg-transparent text-white hover:bg-white/10">
                <ShieldAlert className="mr-2 h-4 w-4" /> Accountability
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" className="rounded-2xl border-white/30 bg-transparent text-white hover:bg-white/10">
                Member view
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card size="sm">
                <CardContent className="p-1">
                  <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${stat.accent} text-white shadow-sm`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-xl font-semibold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Distribution + activity feed, side by side — admin-only content */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="admin-accent-rule inline-block text-lg">Workspace distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <DistributionBars stats={stats} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="admin-accent-rule inline-flex items-center gap-2 text-lg">
              <Activity className="h-4 w-4" /> Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLog.length ? (
              <ul className="max-h-64 space-y-3 overflow-y-auto pr-1">
                {auditLog.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{describeAuditAction(entry)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{entry.actor_email ?? 'Unknown admin'}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(entry.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No admin actions logged yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two-factor setup */}
      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
            <KeyRound className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Two-factor authentication
            </p>
            <p className="mt-1 text-base font-semibold text-foreground">
              Enable Google Authenticator for admin sign-in
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Set up a one-time code so password-only access is no longer enough.
            </p>
            <div className="mt-4">
              <SetupTotpClient />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users table with bulk selection */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Workspace users</CardTitle>
              <p className="text-sm text-muted-foreground">
                {filtered.length} of {localProfiles.length} shown
                {selectedIds.size ? ` · ${selectedIds.size} selected` : ''}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by email or role"
                  className="w-full border-slate-300 bg-white pl-9 text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-400"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between rounded-full border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-white/20 dark:bg-white/5 dark:text-white sm:w-auto"
                  >
                    {SORT_LABELS[sortBy]}
                    <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                    <DropdownMenuItem key={key} onSelect={() => setSortBy(key)}>
                      {SORT_LABELS[key]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        {selectedIds.size > 0 ? (
          <div className="mx-5 mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 py-3">
            <span className="text-sm text-foreground">{selectedIds.size} selected</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" disabled={bulkPending} onClick={() => handleBulkRoleChange('admin')}>
                {bulkPending ? 'Applying…' : 'Make admin'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={bulkPending}
                onClick={() => handleBulkRoleChange('')}
                className="border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                Make member
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                className="text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
              >
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white"
                onClick={handleExportUsers}
                disabled={!filtered.length}
              >
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </div>
          </div>
        ) : null}

        {error_content(errorMessage, schemaError)}

        {!errorMessage && filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-10 px-5 py-3">
                    <button type="button" onClick={toggleSelectAll} aria-label="Select all">
                      {allFilteredSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                  </th>
                  <th className="px-2 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Updated</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-white/10 last:border-b hover:bg-white/5">
                    <td className="px-5 py-3">
                      <button type="button" onClick={() => toggleSelect(p.id)} aria-label={`Select ${p.email}`}>
                        {selectedIds.has(p.id) ? <CheckSquare className="h-4 w-4 text-violet-400" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-xs font-semibold text-white">
                          {initialsFor(p.email)}
                        </div>
                        <span className="text-sm font-medium text-foreground">{p.email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={p.role === 'admin' ? 'default' : 'secondary'}>
                        {p.role === 'admin' ? (
                          <>
                            <Crown className="mr-1 h-3 w-3" /> Admin
                          </>
                        ) : (
                          'Member'
                        )}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {p.updated_at ? new Date(p.updated_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        size="sm"
                        variant={p.role === 'admin' ? 'destructive' : 'default'}
                        disabled={pendingRoleId === p.id}
                        onClick={() => handleToggleRole(p)}
                      >
                        {pendingRoleId === p.id ? 'Saving…' : p.role === 'admin' ? 'Revoke admin' : 'Make admin'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !errorMessage ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No users match your search.</div>
        ) : null}
      </Card>
    </div>
  );
}

function error_content(errorMessage: string | null, schemaError: boolean) {
  if (!errorMessage) return null;
  return (
    <div className="m-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm text-foreground">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Admin data unavailable</p>
          <p className="mt-1 text-sm text-foreground">
            Your Supabase project does not currently have a `profiles` table available for the admin dashboard.
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {schemaError
              ? 'Please verify that the `profiles` table exists in your Supabase database and that your schema is up to date.'
              : errorMessage}
          </p>
        </div>
      </div>
    </div>
  );
}