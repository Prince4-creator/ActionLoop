'use client';

import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { BrandBadge } from '@/components/ui/brand-badge';
import { createClient } from '@/utils/supabase/client';
import { LayoutGrid, Menu, Moon, Settings, Sparkles, SunMedium, Users, LogOut, XIcon } from 'lucide-react';
import { useMemo, useState, useEffect, useRef } from 'react';
import { isAdminUser } from '@/lib/auth';

type AppShellProps = {
  children: React.ReactNode;
  user: Pick<User, 'email' | 'app_metadata' | 'user_metadata'>;
  currentPath: string;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
};

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/meetings', label: 'Meetings', icon: Users },
  { href: '/team/settings', label: 'Team', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const AVATAR_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
];

function gradientForString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

export function AppShell({ children, user, currentPath, title, description, actions }: AppShellProps) {
  const router = useRouter();
  const { theme, mounted, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(220);
  const headerRef = useRef<HTMLElement | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        setHeaderHeight(Math.ceil(headerRef.current.getBoundingClientRect().height));
      }
    };

    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    return () => window.removeEventListener('resize', updateHeaderHeight);
  }, []);

  const themeToggleLabel = mounted ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : 'Toggle theme';
  const ThemeToggleIcon = mounted ? (theme === 'dark' ? SunMedium : Moon) : SunMedium;

  const initials = useMemo(() => {
    const email = user.email ?? 'User';
    return email
      .split('@')[0]
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'U';
  }, [user.email]);

  const avatarGradient = useMemo(() => gradientForString(user.email ?? 'user'), [user.email]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (href: string) => currentPath === href || (href !== '/dashboard' && currentPath.startsWith(href));

  const isAdmin = isAdminUser(user);

  const renderNav = () => (
    <div className="flex flex-col gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-white'
            }`}
          >
            {active ? (
              <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-blue-500" />
            ) : null}
            <Icon className={`h-4 w-4 shrink-0 ${active ? '' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
            <span>{item.label}</span>
          </Link>
        );
      })}

      {isAdmin ? (
        <Link
          href="/admin"
          className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive('/admin')
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-white'
          }`}
        >
          {isActive('/admin') ? (
            <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-blue-500" />
          ) : null}
          <Sparkles className={`h-4 w-4 shrink-0 ${isActive('/admin') ? '' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
          <span>Admin</span>
        </Link>
      ) : null}

      <div className="my-2 h-px bg-slate-200 dark:bg-slate-800" />

      <button
        onClick={handleSignOut}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        <span>Sign out</span>
      </button>
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_45%),linear-gradient(135deg,_#f8fbff_0%,_#eef7ff_100%)] text-foreground dark:bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.15),_transparent_35%),linear-gradient(135deg,_#020617_0%,_#0f172a_100%)]">
      <div className="mx-auto flex w-full max-w-full flex-col lg:flex-row">
        <aside className={`${sidebarOpen ? 'hidden lg:flex' : 'hidden'} shrink-0 border-r border-slate-200/70 px-4 py-5 lg:flex-col dark:border-slate-800/70 lg:z-40 lg:overflow-y-auto lg:transition-all lg:duration-200 bg-white/60 dark:bg-slate-950/60 ${sidebarOpen ? 'lg:fixed lg:top-0 lg:left-0 lg:bottom-0 lg:w-64' : ''}`}>
          <div className="flex items-center gap-2.5 px-1 py-2">
            <BrandBadge compact />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">ActionLoop</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">Follow-through, made elegant</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient} text-sm font-semibold text-white shadow-sm`}>
                  {initials}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{user.email || 'Workspace member'}</p>
                <span
                  className={`mt-0.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                    isAdmin
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {isAdmin ? 'Admin' : 'Member'}
                </span>
              </div>
            </div>

            <nav className="mt-4 flex-1">{renderNav()}</nav>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="mt-3 w-full rounded-xl border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ThemeToggleIcon className="mr-2 h-4 w-4" />
              {themeToggleLabel}
            </Button>
          </div>
        </aside>

        <div className={`flex-1 min-w-0 ${sidebarOpen ? 'lg:ml-64' : ''}`}>
          <header
            ref={headerRef}
            className={`fixed inset-x-0 top-0 z-50 ${sidebarOpen ? 'lg:left-64 lg:right-0' : 'lg:left-0 lg:right-0'} border-b border-slate-200/70 bg-white/95 px-3 py-2 backdrop-blur-xl shadow-sm shadow-slate-900/5 transition-colors duration-200 sm:px-4 sm:py-3 lg:px-6 dark:border-slate-800/70 dark:bg-slate-950/95`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="shrink-0 rounded-xl border-slate-200 bg-white text-slate-900 shadow-sm lg:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      aria-label="Open navigation menu"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[82vw] max-w-xs p-4">
                    <div className="flex items-center gap-2.5 pb-4">
                      <BrandBadge compact />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">ActionLoop</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                      </div>
                    </div>
                    <div className="overflow-y-auto">{renderNav()}</div>
                  </SheetContent>
                </Sheet>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="hidden shrink-0 rounded-xl border-slate-200 bg-white text-slate-900 shadow-sm lg:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                  onClick={() => setSidebarOpen((prev) => !prev)}
                >
                  {sidebarOpen ? <XIcon className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-base">{title || 'Workspace'}</h1>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{description || 'Stay on top of every next step'}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {actions}
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="rounded-xl"
                  aria-label={themeToggleLabel}
                >
                  <ThemeToggleIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          <main className="w-full max-w-full px-3 pb-6 sm:px-6 sm:pb-8 lg:px-8 lg:pb-10" style={{ paddingTop: `${headerHeight + 12}px` }}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}
