'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Briefcase,
  Building2,
  ChevronRight,
  ChevronsUpDown,
  ImageIcon,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  Network,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
  X,
  ArrowRightLeft,
  ScanSearch,
  IdCard,
  Contact,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Clock,
  UsersRound,
  Plane,
  CalendarClock,
  CalendarRange,
  Tags,
  FolderKanban,
  Megaphone,
  Heart,
  Receipt,
  Wallet,
} from 'lucide-react';
import type { ThemeTokens } from '@hrms/types';
import { useAuthStore } from '@/store/useAuthStore';
import { DisplayPreferences } from '@/components/preferences/display-preferences';
import { useAccess } from '@/lib/access/use-access';
import { usePendingCorrections } from '@/lib/company/attendance';
import { usePendingLeave } from '@/lib/company/leave';
import { useIsApprover } from '@/lib/company/projects';
import { useAnnouncements } from '@/lib/company/engagement';
import { usePendingExpenses } from '@/lib/company/expenses';
import { changePasswordPath, loginPathFor, useAuthHydrated, withNext } from '@/lib/auth/portal';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ThemeStyle } from '@/components/theme/theme-style';
import { companyThemeTokens, useCompanyBranding, useCompanyTheme } from '@/lib/company/queries';
import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
  soon?: boolean;
  permission?: string;
  /** Feature that must be enabled for the company */
  feature?: string;
  /** Hide when the permission only reaches the user's own record */
  beyondOwn?: boolean;
  /** Also show for anyone who approves: covering someone, project lead / PM, line manager */
  orDelegated?: boolean;
  /** Live count shown on the item */
  badge?: 'attendanceApprovals' | 'leaveApprovals' | 'announcements' | 'expenseApprovals';
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Overview',
    items: [
      { name: 'Home', href: '/app', icon: LayoutDashboard, exact: true },
      { name: 'My profile', href: '/app/profile', icon: IdCard },
      { name: 'People', href: '/app/people', icon: Contact, permission: 'org.view', feature: 'people.directory' },
    ],
  },
  {
    label: 'Organization',
    items: [
      { name: 'Employees', href: '/app/employees', icon: Users, permission: 'employee.view', beyondOwn: true },
      { name: 'Organisation', href: '/app/org', icon: Network, permission: 'org.view' },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { name: 'Announcements', href: '/app/announcements', icon: Megaphone, permission: 'announcement.view', feature: 'engage.announcements', badge: 'announcements' },
      { name: 'Kudos', href: '/app/kudos', icon: Heart, permission: 'kudos.view', feature: 'engage.kudos' },
    ],
  },
  {
    label: 'Work',
    items: [{ name: 'Projects', href: '/app/projects', icon: FolderKanban, permission: 'project.view', feature: 'work.projects' }],
  },
  {
    label: 'Expenses',
    items: [
      { name: 'My expenses', href: '/app/expenses', icon: Receipt, exact: true, permission: 'expense.submit', feature: 'ops.expenses' },
      { name: 'Expense approvals', href: '/app/expenses/approvals', icon: ClipboardCheck, permission: 'expense.approve', feature: 'ops.expenses', orDelegated: true, badge: 'expenseApprovals' },
      { name: 'Payments & reports', href: '/app/expenses/payments', icon: Wallet, permission: 'expense.finance', feature: 'ops.expenses' },
      { name: 'Expense categories', href: '/app/expenses/categories', icon: Tags, permission: 'expense.manage', feature: 'ops.expenses' },
    ],
  },
  {
    label: 'Time',
    items: [
      { name: 'My attendance', href: '/app/attendance', icon: CalendarCheck, exact: true, permission: 'attendance.view', feature: 'time.attendance' },
      { name: 'Team attendance', href: '/app/attendance/team', icon: UsersRound, permission: 'attendance.view', feature: 'time.attendance', beyondOwn: true },
      { name: 'Attendance approvals', href: '/app/attendance/approvals', icon: ClipboardCheck, permission: 'attendance.approve', feature: 'time.attendance', orDelegated: true, badge: 'attendanceApprovals' },
      { name: 'My leave', href: '/app/leave', icon: Plane, exact: true, permission: 'leave.view', feature: 'time.leave' },
      { name: 'Leave approvals', href: '/app/leave/approvals', icon: CalendarClock, permission: 'leave.approve', feature: 'time.leave', orDelegated: true, badge: 'leaveApprovals' },
      { name: 'Who’s off', href: '/app/leave/calendar', icon: CalendarRange, permission: 'leave.view', feature: 'time.leave', beyondOwn: true },
      { name: 'Holidays', href: '/app/attendance/holidays', icon: CalendarDays, permission: 'attendance.view', feature: 'time.attendance' },
      { name: 'Attendance settings', href: '/app/attendance/settings', icon: Clock, permission: 'attendance.policy', feature: 'time.attendance' },
      { name: 'Leave types', href: '/app/leave/types', icon: Tags, permission: 'leave.manage_types', feature: 'time.leave' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { name: 'Users', href: '/app/users', icon: UserCog, permission: 'user.view' },
      { name: 'Roles & permissions', href: '/app/roles', icon: ShieldCheck, permission: 'role.view' },
      { name: 'Access explorer', href: '/app/access-explorer', icon: ScanSearch, permission: 'role.view' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { name: 'Branding', href: '/app/settings/branding', icon: ImageIcon, permission: 'branding.manage' },
      { name: 'Theme', href: '/app/settings/theme', icon: Palette, permission: 'branding.manage' },
      { name: 'Delegation', href: '/app/delegations', icon: ArrowRightLeft },
      { name: 'Preferences', href: '/app/settings/preferences', icon: SlidersHorizontal },
    ],
  },
];

const SEGMENT_LABELS: Record<string, string> = {
  app: 'Home',
  settings: 'Settings',
  branding: 'Branding',
  theme: 'Theme',
  preferences: 'Preferences',
  employees: 'Employees',
  profile: 'My profile',
  people: 'People',
  attendance: 'Attendance',
  team: 'Team',
  approvals: 'Approvals',
  holidays: 'Holidays',
  leave: 'Leave',
  projects: 'Projects',
  announcements: 'Announcements',
  kudos: 'Kudos',
  expenses: 'Expenses',
  payments: 'Payments & reports',
  categories: 'Categories',
  notifications: 'Notifications',
  calendar: 'Who’s off',
  types: 'Leave types',
  org: 'Organisation',
  'access-explorer': 'Access explorer',
  delegations: 'Delegation',
  import: 'Import',
  users: 'Users',
  roles: 'Roles & permissions',
  new: 'New role',
};


/** Applies the company theme; the last one is cached per company for an instant first paint. */
function CompanyTheme({ companyId }: { companyId: string | null }) {
  const theme = useCompanyTheme(companyId);
  const [cached, setCached] = useState<ThemeTokens | null>(null);
  const cacheKey = `co-theme-${companyId}`;

  useEffect(() => {
    if (!companyId) return;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) setCached(JSON.parse(raw) as ThemeTokens);
    } catch {
      /* storage unavailable or corrupt */
    }
  }, [companyId, cacheKey]);

  const tokens = companyThemeTokens(theme.data) ?? cached;

  useEffect(() => {
    if (!theme.data || !tokens) return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(tokens));
    } catch {
      /* storage unavailable */
    }
  }, [theme.data, tokens, cacheKey]);

  return <ThemeStyle tokens={tokens} />;
}

export default function CompanyPortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const { user, companyId, isAuthenticated, logout } = useAuthStore();
  const { can: canAccess, access, hasFeature, scopeOf } = useAccess();
  const pendingApprovals = usePendingCorrections();
  const pendingLeave = usePendingLeave();
  const isApprover = useIsApprover('leave.approve');
  const announcements = useAnnouncements({ limit: 1 });
  const pendingExpenses = usePendingExpenses();
  const [mobileOpen, setMobileOpen] = useState(false);
  const branding = useCompanyBranding(hydrated ? companyId : null);

  const allowed = hydrated && isAuthenticated && Boolean(user) && Boolean(companyId) && !user?.mustChangePassword;

  // ── Route guard ────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !user) router.replace(withNext(loginPathFor(null), pathname));
    else if (!companyId) router.replace(user.isSuperAdmin ? '/super-admin' : loginPathFor(null));
    else if (user.mustChangePassword) router.replace(changePasswordPath(user, pathname));
  }, [hydrated, isAuthenticated, user, companyId, pathname, router]);

  useEffect(() => setMobileOpen(false), [pathname]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Menus follow live access (/access/me) — refreshed when an admin changes roles or features
  const can = (permission?: string) => !permission || user!.isSuperAdmin || canAccess(permission);
  const companyName = branding.data?.displayName ?? 'Company portal';
  const fullName = `${user!.firstName} ${user!.lastName}`;

  const handleLogout = () => {
    logout();
    router.replace(loginPathFor(null));
  };

  return (
    <div className="flex min-h-screen bg-canvas text-foreground">
      <CompanyTheme companyId={companyId} />
      <DisplayPreferences />
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden animate-in fade-in-0" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-out',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center gap-2.5 px-3">
          <Link href="/app" className="flex min-w-0 items-center gap-2.5">
            {branding.data?.logoUrl ? (
              <img src={branding.data.logoUrl} alt={`${companyName} logo`} className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain p-0.5" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-card">
                {initials(companyName)}
              </span>
            )}
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-sidebar-active-foreground">{companyName}</span>
              <span className="block truncate text-2xs text-sidebar-muted">HR workspace</span>
            </span>
          </Link>
          <button className="ml-auto rounded-md p-1.5 hover:bg-sidebar-active lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter(
              (i) =>
                (can(i.permission) || (i.orDelegated && (isApprover || can('expense.finance') || can('expense.hr'))) || (i.href === '/app/expenses/payments' && can('expense.hr'))) &&
                (!i.feature || user!.isSuperAdmin || hasFeature(i.feature)) &&
                (!i.beyondOwn || user!.isSuperAdmin || scopeOf(i.permission!) !== 'own'),
            );
            if (!items.length) return null;
            return (
              <div key={group.label} className="mb-4">
                <p className="mb-1 px-2 text-2xs font-medium uppercase tracking-wider text-sidebar-muted">{group.label}</p>
                <ul className="space-y-0.5">
                  {items.map(({ name, href, icon: Icon, exact, soon, badge }) => {
                    const count =
                      badge === 'attendanceApprovals' ? pendingApprovals.data : badge === 'leaveApprovals' ? pendingLeave.data : badge === 'announcements' ? announcements.data?.meta.unread : badge === 'expenseApprovals' ? pendingExpenses.data : undefined;
                    const active = exact ? pathname === href : pathname.startsWith(href);
                    const content = (
                      <>
                        {active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" aria-hidden />}
                        <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-sidebar-muted')} />
                        <span className="flex-1 truncate">{name}</span>
                        {soon && <Badge className="px-1.5 py-0 text-2xs">Soon</Badge>}
                        {Boolean(count) && (
                          <span className="rounded-full bg-primary px-1.5 text-2xs font-semibold leading-4 text-primary-foreground tabular-nums" aria-label={`${count} waiting`}>
                            {count}
                          </span>
                        )}
                      </>
                    );
                    const classes = cn(
                      'relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-sidebar-active text-sidebar-active-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground',
                    );
                    return (
                      <li key={href}>
                        {soon ? (
                          <span aria-disabled className={cn(classes, 'cursor-not-allowed opacity-55 hover:bg-transparent')} title="Coming soon">
                            {content}
                          </span>
                        ) : (
                          <Link href={href} aria-current={active ? 'page' : undefined} className={classes}>
                            {content}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <DropdownMenu
            align="left"
            label={user!.email}
            trigger={() => (
              <button className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-sidebar-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-xs font-semibold text-primary-soft-foreground">
                  {initials(fullName)}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[13px] font-medium text-sidebar-active-foreground">{fullName}</span>
                  <span className="block truncate text-2xs text-sidebar-muted">{user!.email}</span>
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-muted" />
              </button>
            )}
            items={[
              { label: 'Preferences', icon: <SlidersHorizontal />, onSelect: () => router.push('/app/settings/preferences') },
              'separator',
              { label: 'Sign out', icon: <LogOut />, danger: true, onSelect: handleLogout },
            ]}
          />
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button className="-ml-1.5 rounded-md p-1.5 hover:bg-subtle lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <Breadcrumbs pathname={pathname} />
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl animate-fade-up" key={pathname}>
            {/* Covering someone's approvals right now */}
            {access?.delegations?.length ? (
              <Link
                href="/app/delegations"
                className="mb-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft/40 px-3 py-2 text-sm text-foreground hover:bg-success-soft/60"
              >
                <ArrowRightLeft className="h-4 w-4 shrink-0 text-success" />
                <span>
                  You’re covering approvals for{' '}
                  {access.delegations.map((d, i) => (
                    <React.Fragment key={d.id}>
                      {i > 0 && ', '}
                      <b>{d.fromName}</b> until {new Date(d.until).toLocaleDateString()}
                    </React.Fragment>
                  ))}
                </span>
              </Link>
            ) : null}
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
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[13px]">
      {segments.map((seg, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/');
        const last = i === segments.length - 1;
        // Record ids (UUIDs) read as "Details" rather than a raw id
        const label = SEGMENT_LABELS[seg] ?? (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(seg) ? 'Details' : seg);
        return (
          <React.Fragment key={href}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
            {last || seg === 'settings' ? (
              <span className={cn('truncate', last ? 'font-medium text-foreground' : 'text-muted-foreground')}>{label}</span>
            ) : (
              <Link href={href} className="truncate rounded px-1 text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground">
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
