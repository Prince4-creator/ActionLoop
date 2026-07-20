'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  Users,
  Settings,
  ShieldCheck,
  Search,
  Plus,
  Inbox,
  KeyRound,
  CornerDownLeft,
} from 'lucide-react';

/**
 * Global command palette (Cmd/Ctrl+K).
 *
 * Drop this once in components/app-shell.tsx (or providers.tsx) so it's
 * available on every authenticated page:
 *
 *   <CommandPalette isAdmin={isAdmin} />
 *
 * No new dependencies — built on the Dialog primitive already in the repo.
 */

type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string;
  adminOnly?: boolean;
};

const BASE_ITEMS: CommandItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutGrid, keywords: 'home overview' },
  { id: 'meetings', label: 'Meetings', href: '/meetings', icon: Users, keywords: 'browse history' },
  { id: 'new-meeting', label: 'New meeting', href: '/meetings/new', icon: Plus, keywords: 'create transcript extract' },
  { id: 'team', label: 'Team', href: '/team', icon: Users, keywords: 'leaderboard members' },
  { id: 'team-settings', label: 'Team settings', href: '/team/settings', icon: Users, keywords: 'invite members roles' },
  { id: 'settings', label: 'Settings', href: '/settings', icon: Settings, keywords: 'slack nudges preferences' },
  { id: 'admin', label: 'Admin dashboard', href: '/admin', icon: ShieldCheck, keywords: 'control center users', adminOnly: true },
  { id: 'admin-requests', label: 'Meeting requests', href: '/admin/requests', icon: Inbox, keywords: 'convert pending', adminOnly: true },
  { id: 'admin-totp', label: 'Two-factor setup', href: '/admin/setup-totp', icon: KeyRound, keywords: 'authenticator 2fa security', adminOnly: true },
];

export function CommandPalette({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const items = useMemo(
    () => BASE_ITEMS.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.keywords?.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Global shortcut: Cmd/Ctrl+K opens, Escape closes (Dialog already handles Escape)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Focus after the dialog mounts
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) go(item.href);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[18%] max-w-lg translate-y-0 gap-0 overflow-hidden rounded-3xl border-white/50 bg-white/85 p-0 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90"
      >
        <div className="flex items-center gap-3 border-b border-black/5 px-4 py-3 dark:border-white/10">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a page…"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block dark:border-white/10 dark:bg-white/10">
            Esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length ? (
            filtered.map((item, index) => {
              const Icon = item.icon;
              const active = index === activeIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => go(item.href)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors',
                    active
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-foreground hover:bg-black/5 dark:hover:bg-white/10'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active ? '' : 'text-muted-foreground')} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {active ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-70" /> : null}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No pages match &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}