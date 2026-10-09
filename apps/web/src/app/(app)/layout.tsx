'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ImageIcon,
  Pin,
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
  HardDrive,
  PackageCheck,
  PackageOpen,
  Inbox,
  Users2,
  LifeBuoy,
  Headset,
  Timer,
  LineChart,
} from 'lucide-react';
import { MENU_STYLES, type MenuStyle, type ThemeTokens } from '@hrms/types';
import { useAuthStore } from '@/store/useAuthStore';
import { DisplayPreferences } from '@/components/preferences/display-preferences';
import { MaintenanceGate } from '@/components/layout/maintenance-gate';
import { PageBackdrop } from '@/components/motion/page-backdrop';
import { useAccess } from '@/lib/access/use-access';
import { usePendingCorrections } from '@/lib/company/attendance';
import { usePendingLeave } from '@/lib/company/leave';
import { useIsApprover } from '@/lib/company/projects';
import { HOME_ANNOUNCEMENTS, useAnnouncements } from '@/lib/company/engagement';
import { usePendingExpenses } from '@/lib/company/expenses';
import { usePendingAssetRequests } from '@/lib/company/assets';
import { useHelpdeskCounts } from '@/lib/company/helpdesk';
import { usePendingTimesheets } from '@/lib/company/timesheets';
import { usePendingResourceRequests, useResourceContext } from '@/lib/company/resources';
import { changePasswordPath, loginPathFor, useAuthHydrated, withNext } from '@/lib/auth/portal';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { LiveConnection, LiveDot } from '@/components/live/live-connection';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { ThemeStyle } from '@/components/theme/theme-style';
import { useBrandFavicon } from '@/components/branding/brand-favicon';
import { companyThemeTokens, useCompanyBranding, useCompanyTheme, usePreferences, type CompanyThemeResponse, type UserPreferences } from '@/lib/company/queries';
import { findPreset } from '@/lib/theme/presets';
import { rebrandTheme } from '@/lib/theme/generate';
import { SeasonPopup, useSeasonLook } from '@/components/season/season';
import { A11yPrefs } from '@/components/preferences/a11y-prefs';
import { ClassicNav, CollapsibleNav, FloatingNav, type SidebarGroup } from '@/components/layout/sidebar-nav';
import { NavProgress, PageSkeleton, usePendingNav } from '@/components/layout/pending-nav';
import { TreeNav, useGlideFolded, useIsDesktop, usePeekHover, usePeekPinned } from '@/components/layout/tree-nav';
import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';
import { BrandMedia } from '@/components/brand/brand-media';

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
  /** Also show when the user holds any of these */
  anyOf?: string[];
  /** Also shown to members of company-made helpdesk teams (no role permission) */
  helpdeskTeam?: boolean;
  /** Only when the permission reaches the whole company */
  companyWide?: boolean;
  /** Resource requests: leads, PMs, Delivery Directors and the PMO (their role on projects) */
  projectRole?: boolean;
  /** Live count shown on the item */
  badge?: 'attendanceApprovals' | 'leaveApprovals' | 'announcements' | 'expenseApprovals' | 'assetRequests' | 'myTickets' | 'ticketQueue' | 'timesheetApprovals' | 'resourceRequests';
}

const NAV_GROUPS: Array<{ label: string; icon: React.ElementType; items: NavItem[] }> = [
  {
    label: 'Overview',
    icon: LayoutDashboard,
    items: [
      { name: 'Home', href: '/app', icon: LayoutDashboard, exact: true },
      { name: 'My profile', href: '/app/profile', icon: IdCard },
      { name: 'Reports & analytics', href: '/app/reports', icon: LineChart, permission: 'report.view', anyOf: ['project.manage'] },
      { name: 'People', href: '/app/people', icon: Contact, permission: 'org.view', feature: 'people.directory' },
    ],
  },
  {
    label: 'Organization',
    icon: Network,
    items: [
      { name: 'Employees', href: '/app/employees', icon: Users, permission: 'employee.view', beyondOwn: true },
      { name: 'Organisation', href: '/app/org', icon: Network, permission: 'org.view' },
    ],
  },
  {
    label: 'Engagement',
    icon: Megaphone,
    items: [
      { name: 'Announcements', href: '/app/announcements', icon: Megaphone, permission: 'announcement.view', feature: 'engage.announcements', badge: 'announcements' },
      { name: 'Shout-outs', href: '/app/kudos', icon: Heart, permission: 'kudos.view', feature: 'engage.kudos' },
    ],
  },
  {
    label: 'Work',
    icon: FolderKanban,
    items: [
      { name: 'Projects', href: '/app/projects', icon: FolderKanban, permission: 'project.view', feature: 'work.projects' },
      { name: 'Resource requests', href: '/app/resources', icon: Inbox, permission: 'project.view', feature: 'work.projects', projectRole: true, badge: 'resourceRequests' },
      { name: 'PMO pool', href: '/app/pmo-pool', icon: Users2, permission: 'project.manage', feature: 'work.projects' },
      { name: 'My timesheet', href: '/app/timesheets', icon: Timer, exact: true, permission: 'timesheet.submit', feature: 'work.timesheets' },
      { name: 'Timesheet approvals', href: '/app/timesheets/approvals', icon: ClipboardCheck, permission: 'timesheet.approve', feature: 'work.timesheets', orDelegated: true, badge: 'timesheetApprovals' },
    ],
  },
  {
    label: 'Expenses',
    icon: Receipt,
    items: [
      { name: 'My expenses', href: '/app/expenses', icon: Receipt, exact: true, permission: 'expense.submit', feature: 'ops.expenses' },
      { name: 'Expense approvals', href: '/app/expenses/approvals', icon: ClipboardCheck, permission: 'expense.approve', feature: 'ops.expenses', orDelegated: true, badge: 'expenseApprovals' },
      { name: 'Payments & reports', href: '/app/expenses/payments', icon: Wallet, permission: 'expense.finance', feature: 'ops.expenses' },
      { name: 'Expense categories', href: '/app/expenses/categories', icon: Tags, permission: 'expense.manage', feature: 'ops.expenses' },
    ],
  },
  {
    label: 'Assets',
    icon: HardDrive,
    items: [
      { name: 'My assets', href: '/app/assets/mine', icon: PackageCheck, permission: 'asset.view', feature: 'ops.assets' },
      { name: 'Asset requests', href: '/app/assets/requests', icon: PackageOpen, permission: 'asset.manage', anyOf: ['asset.approve_it', 'asset.approve_hr'], feature: 'ops.assets', badge: 'assetRequests' },
      { name: 'Asset register', href: '/app/assets', icon: HardDrive, exact: true, permission: 'asset.view', companyWide: true, feature: 'ops.assets' },
      { name: 'Asset types', href: '/app/assets/types', icon: Tags, permission: 'asset.manage', feature: 'ops.assets' },
    ],
  },
  {
    label: 'Helpdesk',
    icon: LifeBuoy,
    items: [
      { name: 'My tickets', href: '/app/helpdesk', icon: LifeBuoy, exact: true, permission: 'ticket.view', feature: 'ops.helpdesk', badge: 'myTickets' },
      { name: 'Ticket queue', href: '/app/helpdesk/queue', icon: Headset, permission: 'ticket.handle_it', anyOf: ['ticket.handle_hr', 'ticket.handle_finance', 'ticket.handle_devops'], helpdeskTeam: true, feature: 'ops.helpdesk', badge: 'ticketQueue' },
      { name: 'Ticket topics', href: '/app/helpdesk/categories', icon: Tags, permission: 'ticket.handle_it', anyOf: ['ticket.handle_hr', 'ticket.handle_finance', 'ticket.handle_devops', 'ticket.manage_teams'], helpdeskTeam: true, feature: 'ops.helpdesk' },
    ],
  },
  {
    label: 'Time',
    icon: Clock,
    items: [
      { name: 'My attendance', href: '/app/attendance', icon: CalendarCheck, exact: true, permission: 'attendance.view', feature: 'time.attendance' },
      { name: 'Team attendance', href: '/app/attendance/team', icon: UsersRound, permission: 'attendance.view', feature: 'time.attendance', beyondOwn: true },
      { name: 'Attendance approvals', href: '/app/attendance/approvals', icon: ClipboardCheck, permission: 'attendance.approve', feature: 'time.attendance', orDelegated: true, badge: 'attendanceApprovals' },
      { name: 'My leave', href: '/app/leave', icon: Plane, exact: true, permission: 'leave.view', feature: 'time.leave' },
      { name: 'Leave approvals', href: '/app/leave/approvals', icon: CalendarClock, permission: 'leave.approve', feature: 'time.leave', orDelegated: true, badge: 'leaveApprovals' },
      { name: 'Who’s off', href: '/app/leave/calendar', icon: CalendarRange, permission: 'leave.view', feature: 'time.leave' },
      { name: 'Holidays', href: '/app/attendance/holidays', icon: CalendarDays, permission: 'attendance.view', feature: 'time.attendance' },
      { name: 'Attendance settings', href: '/app/attendance/settings', icon: Clock, permission: 'attendance.policy', feature: 'time.attendance' },
      { name: 'Leave types', href: '/app/leave/types', icon: Tags, permission: 'leave.manage_types', feature: 'time.leave' },
    ],
  },
  {
    label: 'Administration',
    icon: ShieldCheck,
    items: [
      { name: 'Users', href: '/app/users', icon: UserCog, permission: 'user.view' },
      { name: 'Roles & permissions', href: '/app/roles', icon: ShieldCheck, permission: 'role.view' },
      { name: 'Access explorer', href: '/app/access-explorer', icon: ScanSearch, permission: 'role.view' },
    ],
  },
  {
    label: 'Settings',
    icon: SlidersHorizontal,
    items: [
      { name: 'Branding', href: '/app/settings/branding', icon: ImageIcon, permission: 'branding.manage' },
      { name: 'Theme', href: '/app/settings/theme', icon: Palette, permission: 'branding.manage', anyOf: ['theme.seasonal'] },
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
  kudos: 'Shout-outs',
  wishes: 'Your wishes',
  expenses: 'Expenses',
  payments: 'Payments & reports',
  categories: 'Categories',
  notifications: 'Notifications',
  calendar: 'Who’s off',
  types: 'Types',
  assets: 'Assets',
  mine: 'My assets',
  requests: 'Requests',
  request: 'Request',
  helpdesk: 'Helpdesk',
  queue: 'Queue',
  timesheets: 'Timesheets',
  reports: 'Reports & analytics',
  org: 'Organisation',
  'access-explorer': 'Access explorer',
  delegations: 'Delegation',
  import: 'Import',
  users: 'Users',
  roles: 'Roles & permissions',
  new: 'New',
  compare: 'Compare',
  edit: 'Edit',
  insights: 'Insights',
  planner: 'Resource planner',
  resources: 'Resource requests',
  'pmo-pool': 'PMO pool',
};


/** The built-in theme an employee picked, when their company allows it. */
function personalThemeKey(theme: CompanyThemeResponse | undefined, prefs: UserPreferences | undefined): string | null {
  const key = prefs?.colorTheme;
  const rules = theme?.personalization;
  if (!key || !rules?.personalThemes || !findPreset(key)) return null;
  return !rules.allowedThemes.length || rules.allowedThemes.includes(key) ? key : null;
}

/** The menu style to show: the employee's pick when allowed, else the company default. */
function effectiveMenuStyle(theme: CompanyThemeResponse | undefined, prefs: UserPreferences | undefined): MenuStyle {
  const rules = theme?.personalization;
  // Older saved values (e.g. the removed "rail") fall back to classic
  const known = (s: MenuStyle | null | undefined) => (s && (MENU_STYLES as readonly string[]).includes(s) ? s : null);
  if (rules?.personalMenuStyle && known(prefs?.menuStyle)) return prefs!.menuStyle!;
  return known(rules?.defaultMenuStyle) ?? 'classic';
}

/**
 * Applies the company theme, or the employee's own theme when the company allows it.
 * The last one is cached per company and user for an instant first paint.
 */
function CompanyTheme({ companyId, userId }: { companyId: string | null; userId: string }) {
  const theme = useCompanyTheme(companyId);
  const prefs = usePreferences();
  const [cached, setCached] = useState<ThemeTokens | null>(null);
  const cacheKey = `co-theme-${companyId}-${userId}`;

  useEffect(() => {
    if (!companyId) return;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) setCached(JSON.parse(raw) as ThemeTokens);
    } catch {
      /* storage unavailable or corrupt */
    }
  }, [companyId, cacheKey]);

  const ready = Boolean(theme.data && prefs.data);
  const personal = personalThemeKey(theme.data, prefs.data);
  const tokens = ready ? (personal ? findPreset(personal)!.tokens : companyThemeTokens(theme.data)) : (cached ?? companyThemeTokens(theme.data));
  // A seasonal theme is on for everyone (each person can switch back to their own)
  const look = useSeasonLook();
  const shown = React.useMemo(() => (look.applies && look.season && tokens ? rebrandTheme(tokens, look.season.colors.main) : tokens), [look.applies, look.season, tokens]);

  useEffect(() => {
    if (!ready || !tokens) return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(tokens));
    } catch {
      /* storage unavailable */
    }
  }, [ready, tokens, cacheKey]);

  return <ThemeStyle tokens={shown} />;
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
  // Same request as the Home card (React Query sends it once)
  const announcements = useAnnouncements(HOME_ANNOUNCEMENTS);
  const pendingExpenses = usePendingExpenses();
  const pendingAssets = usePendingAssetRequests();
  const tickets = useHelpdeskCounts();
  const pendingTimesheets = usePendingTimesheets();
  const resourceContext = useResourceContext();
  const pendingResources = usePendingResourceRequests();
  const [mobileOpen, setMobileOpen] = useState(false);
  const branding = useCompanyBranding(hydrated ? companyId : null);
  useBrandFavicon(branding.data?.faviconUrl);
  const companyTheme = useCompanyTheme(hydrated ? companyId : null);
  const prefs = usePreferences();
  const menuStyle = useMenuStyle(companyTheme.data, prefs.data, user?.id);
  // The page just clicked; shown at once while it loads
  const pendingPath = usePendingNav(pathname);
  const navPath = pendingPath ?? pathname;
  // Glide (folds to icons) and Peek (icons that open on hover) — desktop only
  const desktop = useIsDesktop();
  const [glideFolded, setGlideFolded] = useGlideFolded();
  const [peekPinned, setPeekPinned] = usePeekPinned();
  const peek = usePeekHover();
  const isGlide = menuStyle === 'glide';
  const isPeek = menuStyle === 'peek';
  const compact = desktop && ((isGlide && glideFolded) || (isPeek && !peekPinned && !peek.open));
  const peekOver = desktop && isPeek && !peekPinned && peek.open;
  const peekClose = peek.close;
  useEffect(() => peekClose(), [pathname, peekClose]);
  // Ctrl + \ folds / unfolds Glide
  useEffect(() => {
    if (!isGlide) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        setGlideFolded(!glideFolded);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isGlide, glideFolded, setGlideFolded]);
  const searchMenu = () => {
    if (isGlide) setGlideFolded(false);
    else peek.show();
    setTimeout(() => document.querySelector<HTMLInputElement>('[data-menu-search]')?.focus(), 80);
  };

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

  // The menu, filtered by access and features, with live counts
  const counts: Record<NonNullable<NavItem['badge']>, number | undefined> = {
    attendanceApprovals: pendingApprovals.data,
    leaveApprovals: pendingLeave.data,
    announcements: announcements.data?.meta.unread,
    expenseApprovals: pendingExpenses.data,
    assetRequests: pendingAssets.data,
    myTickets: tickets.data?.mine,
    ticketQueue: tickets.data?.queue,
    timesheetApprovals: pendingTimesheets.data,
    resourceRequests: pendingResources.data,
  };
  const groups: SidebarGroup[] = NAV_GROUPS.map((group) => ({
    label: group.label,
    icon: group.icon,
    items: group.items
      .filter(
        (i) =>
          (can(i.permission) || (i.orDelegated && (isApprover || (i.href.startsWith('/app/expenses') && (can('expense.finance') || can('expense.hr'))))) || (i.href === '/app/expenses/payments' && can('expense.hr')) || Boolean(i.anyOf?.some((p) => can(p))) || Boolean(i.helpdeskTeam && tickets.data?.works)) &&
          (!i.companyWide || user!.isSuperAdmin || scopeOf(i.permission!) === 'company') &&
          (!i.feature || user!.isSuperAdmin || hasFeature(i.feature)) &&
          (!i.beyondOwn || user!.isSuperAdmin || scopeOf(i.permission!) !== 'own') &&
          (!i.projectRole || Boolean(resourceContext.data?.involved)),
      )
      .map(({ name, href, icon, exact, soon, badge }) => ({ name, href, icon, exact, soon, count: badge ? counts[badge] : undefined })),
  })).filter((g) => g.items.length);

  const handleLogout = () => {
    logout();
    router.replace(loginPathFor(null));
  };

  return (
    <MaintenanceGate>
      <div className="isolate flex min-h-screen bg-canvas text-foreground">
        <PageBackdrop />
        <CompanyTheme companyId={companyId} userId={user!.id} />
        <DisplayPreferences />
        <A11yPrefs />
        <SeasonPopup />
        {mobileOpen && (
          <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden animate-in fade-in-0" onClick={() => setMobileOpen(false)} />
        )}

        {/* Peek sits over the page; this keeps its room in the row */}
        {isPeek && <div aria-hidden className="m-peek hidden shrink-0 lg:block" style={{ width: peekPinned ? 252 : 68 }} />}

        {/* ── Sidebar ─────────────────────────────────────── */}
        <aside
          {...(isPeek && desktop && !peekPinned ? peek.handlers : {})}
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-out',
            'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
            menuStyle === 'floating' && 'lg:top-3 lg:m-3 lg:mr-0 lg:h-[calc(100vh-1.5rem)] lg:rounded-2xl lg:border lg:shadow-card',
            isGlide && 'm-glide lg:top-3 lg:m-3 lg:mr-0 lg:h-[calc(100vh-1.5rem)] lg:rounded-[20px] lg:border lg:shadow-[0_12px_32px_-18px_rgb(20_20_60/0.35)]',
            isGlide && (compact ? 'lg:w-[76px]' : 'lg:w-[260px]'),
            isPeek && 'm-peek lg:fixed lg:inset-y-0 lg:left-0',
            isPeek && (compact ? 'lg:w-[68px]' : 'lg:w-[252px]'),
            peekOver && 'lg:shadow-[24px_0_60px_-20px_rgb(0_0_0/0.45)]',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {isGlide && (
            <Tooltip content={compact ? 'Open the menu' : 'Fold to icons'} shortcut="Ctrl \" side="right">
              <button
                type="button"
                onClick={() => setGlideFolded(!glideFolded)}
                aria-label={compact ? 'Open the menu' : 'Fold the menu to icons'}
                aria-expanded={!compact}
                className="m-glide-handle absolute -right-3 top-[22px] z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-muted shadow-card transition-colors hover:text-sidebar-active-foreground lg:flex"
              >
                <ChevronLeft className={cn('h-3.5 w-3.5', compact && 'rotate-180')} />
              </button>
            </Tooltip>
          )}
          <div className={cn('flex h-14 shrink-0 items-center gap-2.5 px-3', compact && 'justify-center px-0')}>
            <Link href="/app" className="flex min-w-0 items-center gap-2.5" title={companyName}>
              {branding.data?.logoUrl ? (
                <>
                  <span className={cn('flex h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-white p-0.5', branding.data.logoDarkUrl && 'dark:hidden')}>
                    <BrandMedia src={branding.data.logoUrl} alt={`${companyName} logo`} className="h-full w-full" />
                  </span>
                  {branding.data.logoDarkUrl && (
                    <span className="hidden h-8 w-8 shrink-0 overflow-hidden rounded-lg dark:flex">
                      <BrandMedia src={branding.data.logoDarkUrl} alt={`${companyName} logo`} className="h-full w-full" />
                    </span>
                  )}
                </>
              ) : (
                <span className="m-shine flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/75 text-xs font-bold text-primary-foreground shadow-card">
                  {initials(companyName)}
                </span>
              )}
              <span className={cn('min-w-0 leading-tight', compact && 'hidden')}>
                <span className="block truncate text-sm font-semibold text-sidebar-active-foreground">{companyName}</span>
                <span className="block truncate text-2xs text-sidebar-muted">{branding.data?.tagline || 'HR workspace'}</span>
              </span>
            </Link>
            <button className="ml-auto rounded-md p-1.5 hover:bg-sidebar-active lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X className="h-4 w-4" />
            </button>
          </div>

          {isGlide || isPeek ? (
            <TreeNav groups={groups} pathname={navPath} compact={compact} onSearch={searchMenu} />
          ) : menuStyle === 'floating' ? (
            <FloatingNav groups={groups} pathname={navPath} />
          ) : menuStyle === 'collapsible' ? (
            <CollapsibleNav groups={groups} pathname={navPath} />
          ) : (
            <ClassicNav groups={groups} pathname={navPath} />
          )}

          {isPeek && !compact && desktop && (
            <div className="mx-2 flex items-center gap-2 border-t border-sidebar-border px-2 py-2.5 text-[13px] font-medium text-sidebar-muted">
              <Pin className="h-3.5 w-3.5" />
              <span className="flex-1">Keep open</span>
              <button
                type="button"
                role="switch"
                aria-checked={peekPinned}
                onClick={() => setPeekPinned(!peekPinned)}
                className={cn('relative h-5 w-9 rounded-full transition-colors', peekPinned ? 'bg-primary' : 'bg-sidebar-border')}
              >
                <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]', peekPinned ? 'left-[18px]' : 'left-0.5')} />
              </button>
            </div>
          )}
          <div className="border-t border-sidebar-border p-2">
            <DropdownMenu
              align="left"
              label={user!.email}
              trigger={() => (
                <button
                  className={cn('flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-sidebar-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', compact && 'justify-center')}
                  title={compact ? fullName : undefined}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-xs font-semibold text-primary-soft-foreground">
                    {initials(fullName)}
                  </span>
                  <span className={cn('min-w-0 flex-1 leading-tight', compact && 'hidden')}>
                    <span className="block truncate text-[13px] font-medium text-sidebar-active-foreground">{fullName}</span>
                    <span className="block truncate text-2xs text-sidebar-muted">{user!.email}</span>
                  </span>
                  <ChevronsUpDown className={cn('h-3.5 w-3.5 text-sidebar-muted', compact && 'hidden')} />
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
              <LiveConnection />
              <LiveDot className="mr-1" />
              <NotificationBell />
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <NavProgress active={Boolean(pendingPath)} />
            <div className={cn('mx-auto duration-150 animate-in fade-in-0', navPath === '/app' ? 'max-w-[1500px]' : 'max-w-6xl')} key={navPath}>
              {pendingPath ? (
                <PageSkeleton />
              ) : (
                <>
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
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </MaintenanceGate>
  );
}

/** Menu style with a per-user cache, so a reload doesn't flash the classic menu first. */
function useMenuStyle(theme: CompanyThemeResponse | undefined, prefs: UserPreferences | undefined, userId: string | undefined): MenuStyle {
  const [cached, setCached] = useState<MenuStyle | null>(null);
  const key = `menu-style-${userId}`;
  const style = theme && prefs ? effectiveMenuStyle(theme, prefs) : null;
  useEffect(() => {
    if (!userId) return;
    try {
      if (style) localStorage.setItem(key, style);
      else setCached((MENU_STYLES as readonly string[]).includes(localStorage.getItem(key) ?? '') ? (localStorage.getItem(key) as MenuStyle) : null);
    } catch {
      /* storage unavailable */
    }
  }, [style, key, userId]);
  return style ?? cached ?? 'classic';
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
