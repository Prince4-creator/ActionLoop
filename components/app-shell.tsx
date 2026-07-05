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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (href: string) => currentPath === href || (href !== '/dashboard' && currentPath.startsWith(href));

  const renderNav = () => (
    <div className="flex flex-col gap-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-base font-semibold transition ${
              isActive(item.href)
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            }`}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}

      {isAdmin ? (
        <Link
          href="/admin"
          className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-base font-semibold transition ${
            isActive('/admin')
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
          }`}
        >
          <Sparkles className="h-5 w-5" />
          <span>Admin</span>
        </Link>
      ) : null}

      <button
        onClick={handleSignOut}
        className="mt-4 flex items-center gap-3 rounded-2xl px-3 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <LogOut className="h-5 w-5" />
        <span>Sign Out</span>
      </button>
    </div>
  );

  const isAdmin = isAdminUser(user);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_45%),linear-gradient(135deg,_#f8fbff_0%,_#eef7ff_100%)] text-foreground dark:bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.15),_transparent_35%),linear-gradient(135deg,_#020617_0%,_#0f172a_100%)]">
      <div className="mx-auto flex w-full max-w-full flex-col lg:flex-row">
        <aside className={`${sidebarOpen ? 'hidden lg:flex' : 'hidden'} shrink-0 border-r border-white/40 px-5 py-6 lg:flex-col bg-gradient-to-b from-white/70 to-white/50 dark:from-slate-900/70 dark:to-slate-900/50 lg:z-40 lg:overflow-y-auto lg:transition-all lg:duration-200 ${sidebarOpen ? 'lg:fixed lg:top-0 lg:left-0 lg:bottom-0 lg:w-72' : ''}`}>
          <div className="flex items-center gap-3 rounded-2xl border border-blue-200/50 bg-gradient-to-r from-blue-50/80 to-blue-100/80 p-4 shadow-sm backdrop-blur dark:border-blue-900/50 dark:from-blue-950/60 dark:to-blue-900/60">
            <BrandBadge compact />
            <div>
              <p className="text-base font-black bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">ActionLoop</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">Follow-through, made elegant</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/50 bg-white/60 p-4 shadow-sm backdrop-blur dark:bg-slate-900/60">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-base font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                {initials}
              </div>
              <div>
                <p className="text-base font-semibold">{user.email || 'Workspace member'}</p>
                <p className="text-sm text-muted-foreground">Signed in</p>
              </div>
            </div>

            <nav className="mt-6 flex-1">{renderNav()}</nav>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="mt-6 w-full rounded-2xl border-white/50 bg-white/70 backdrop-blur dark:bg-slate-900/70"
            >
              <ThemeToggleIcon className="mr-2 h-4 w-4" />
              {themeToggleLabel}
            </Button>
          </div>
        </aside>

        <div className={`flex-1 min-w-0 ${sidebarOpen ? 'lg:ml-72' : ''}`}>
          <header ref={headerRef} className={`fixed inset-x-0 top-0 z-50 ${sidebarOpen ? 'lg:left-72 lg:right-0' : 'lg:left-0 lg:right-0'} border-b border-white/40 bg-white/95 px-3 py-3 backdrop-blur-xl shadow-sm shadow-slate-900/5 transition-colors duration-200 sm:px-4 lg:px-6 dark:border-slate-700/40 dark:bg-slate-950/95`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="lg"
                      className="lg:hidden rounded-2xl border-white/50 bg-white/95 text-slate-900 shadow-sm dark:bg-slate-900/90 dark:text-slate-100"
                      aria-label="Open navigation menu"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[85vw] max-w-xs p-5">
                    <div className="mt-4 overflow-y-auto">{renderNav()}</div>
                  </SheetContent>
                </Sheet>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="hidden rounded-2xl border-white/50 bg-white/95 text-slate-900 shadow-sm dark:bg-slate-900/90 dark:text-slate-100 lg:inline-flex"
                  aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                  onClick={() => setSidebarOpen((prev) => !prev)}
                >
                  {sidebarOpen ? <XIcon className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">ActionLoop</p>
                  <h1 className="text-2xl font-black text-slate-950 dark:text-slate-100 sm:text-3xl bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">{description || 'Stay on top of every next step'}</h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{title || 'Workspace'}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {actions}
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="rounded-2xl"
                >
                  <ThemeToggleIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          <main className="w-full max-w-full px-3 pb-8 sm:px-6 sm:pb-8 lg:px-8 lg:pb-10" style={{ paddingTop: `${headerHeight + 16}px` }}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}
