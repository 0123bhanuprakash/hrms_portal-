'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Activity,
  Building2,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  ServerCog,
  ShieldCheck,
  UserCircle,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { useOpenQueueDashboard, useSystemStatus } from '@/lib/admin/queries';
import { getApiErrorMessage } from '@/lib/errors';
import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';

const NAV = [
  { name: 'Dashboard', href: '/super-admin', icon: LayoutDashboard, exact: true },
  { name: 'Companies', href: '/super-admin/companies', icon: Building2 },
  { name: 'Audit Logs', href: '/super-admin/audit-logs', icon: FileText },
  { name: 'System', href: '/super-admin/system', icon: ServerCog },
];

const SEGMENT_LABELS: Record<string, string> = {
  'super-admin': 'Platform',
  companies: 'Companies',
  new: 'Onboard',
  'audit-logs': 'Audit Logs',
  system: 'System',
  profile: 'Profile',
};

/**
 * Wait for zustand to restore the session from localStorage before guarding.
 * `persist` is undefined during server rendering (no localStorage), so it is
 * only touched inside the effect.
 */
function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const persist = useAuthStore.persist;
    if (!persist || persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const allowed = hydrated && isAuthenticated && Boolean(user?.isSuperAdmin);

  // ── Route guard ────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (!user.isSuperAdmin) {
      toast.error('The platform portal is only available to Super Admins.');
      router.replace('/app');
    }
  }, [hydrated, isAuthenticated, user, pathname, router]);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('sa-sidebar-collapsed') === '1');
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('sa-sidebar-collapsed', c ? '0' : '1');
      } catch {
        /* storage unavailable */
      }
      return !c;
    });
  };

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden animate-fade-in" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          collapsed ? 'lg:w-[72px]' : 'lg:w-64',
          mobileOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 px-4 border-b border-slate-200 dark:border-slate-800">
          <Link href="/super-admin" className="flex items-center gap-2.5 overflow-hidden">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-600/30">
              <ShieldCheck className="h-5 w-5" />
            </span>
            {!collapsed && (
              <span className="leading-tight">
                <span className="block text-sm font-bold">HRMS</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">Platform Admin</span>
              </span>
            )}
          </Link>
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ name, href, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? name : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                  collapsed && 'lg:justify-center lg:px-0',
                  active
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className={cn(collapsed && 'lg:hidden')}>{name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={toggleCollapsed}
            className="hidden lg:flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
          </button>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <Breadcrumbs pathname={pathname} />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <SystemPill />
            <QueueButton />
            <ThemeToggle />
            <DropdownMenu
              trigger={({ toggle, open }) => (
                <button
                  onClick={toggle}
                  className={cn(
                    'flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800',
                    open && 'bg-slate-100 dark:bg-slate-800',
                  )}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
                    {initials(`${user!.firstName} ${user!.lastName}`)}
                  </span>
                  <span className="hidden md:block text-left leading-tight">
                    <span className="block text-xs font-semibold">{user!.firstName} {user!.lastName}</span>
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400">Super Admin</span>
                  </span>
                  <ChevronDown className="hidden md:block h-3.5 w-3.5 text-slate-400" />
                </button>
              )}
              items={[
                { label: 'Profile & security', icon: <UserCircle />, onSelect: () => router.push('/super-admin/profile') },
                'separator',
                { label: 'Sign out', icon: <LogOut />, danger: true, onSelect: handleLogout },
              ]}
            />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl animate-fade-up" key={pathname}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const segments = pathname.split('/').filter(Boolean);
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      {segments.map((seg, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/');
        const last = i === segments.length - 1;
        const label = SEGMENT_LABELS[seg] ?? (/^[0-9a-f-]{36}$/.test(seg) ? 'Details' : seg);
        return (
          <React.Fragment key={href}>
            {i > 0 && <span className="text-slate-300 dark:text-slate-600">/</span>}
            {last ? (
              <span className="truncate font-semibold text-slate-900 dark:text-white">{label}</span>
            ) : (
              <Link href={href} className="truncate text-slate-500 hover:text-slate-900 dark:hover:text-white">
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/** Green / red dot reflecting platform health; links to the System page. */
function SystemPill() {
  const { data, isError } = useSystemStatus({ refetchInterval: 60_000 });
  const ok = !isError && data?.health.status === 'ok';
  return (
    <Link
      href="/super-admin/system"
      title={data ? (ok ? 'All systems operational' : 'Some services are unavailable') : 'Checking system status…'}
      className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      <span className="relative flex h-2 w-2">
        {data && <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', ok ? 'bg-emerald-400' : 'bg-red-400')} />}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', !data ? 'bg-slate-400' : ok ? 'bg-emerald-500' : 'bg-red-500')} />
      </span>
      {data ? (ok ? 'Operational' : 'Degraded') : 'Checking'}
    </Link>
  );
}

/** Opens Bull Board via a short-lived httpOnly session cookie. Hidden when the queue is off. */
function QueueButton() {
  const { data } = useSystemStatus();
  const open = useOpenQueueDashboard();
  if (!data?.queue.enabled) return null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000/api/v1';
  const onClick = async () => {
    const tab = window.open('about:blank', '_blank'); // synchronous, avoids popup blockers
    try {
      await open.mutateAsync();
      if (tab) tab.location.href = `${apiUrl}/admin/queues/`;
    } catch (err) {
      tab?.close();
      toast.error(getApiErrorMessage(err, 'Queue dashboard is unavailable'));
    }
  };

  return (
    <button
      onClick={onClick}
      className="hidden md:flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      <Activity className="h-3.5 w-3.5 text-indigo-500" />
      Queues
      <ExternalLink className="h-3 w-3 text-slate-400" />
    </button>
  );
}
