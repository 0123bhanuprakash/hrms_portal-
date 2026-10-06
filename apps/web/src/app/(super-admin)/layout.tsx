'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Activity,
  Building2,
  ChevronRight,
  ChevronsUpDown,
  ExternalLink,
  FileText,
  Keyboard,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  ServerCog,
  ShieldCheck,
  UserCircle,
  X,
  Layers,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { changePasswordPath, useAuthHydrated, withNext } from '@/lib/auth/portal';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LiveConnection, LiveDot } from '@/components/live/live-connection';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/badge';
import { CommandMenu, NAV_SHORTCUTS, ShortcutsDialog } from '@/components/super-admin/command-menu';
import { useOpenQueueDashboard, useSystemStatus, useThemeSettings } from '@/lib/admin/queries';
import { ThemeStyle } from '@/components/theme/theme-style';
import { DisplayPreferences } from '@/components/preferences/display-preferences';
import { CollapsibleNav, FloatingNav, type SidebarGroup } from '@/components/layout/sidebar-nav';
import { usePreferences, type UserPreferences } from '@/lib/company/queries';
import { ReauthDialog, useIdleSignOut } from '@/components/super-admin/account-guards';
import { resolveTheme } from '@/lib/theme/presets';
import { MENU_STYLES, type MenuStyle, type ThemeTokens } from '@hrms/types';
import { getApiErrorMessage } from '@/lib/errors';
import { initials } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PageBackdrop } from '@/components/motion/page-backdrop';

const NAV_GROUPS: SidebarGroup[] = [
  { label: 'Overview', icon: LayoutDashboard, items: [{ name: 'Dashboard', href: '/super-admin', icon: LayoutDashboard, exact: true }] },
  {
    label: 'Tenants',
    icon: Building2,
    items: [
      { name: 'Companies', href: '/super-admin/companies', icon: Building2, exact: true },
      { name: 'Onboard company', href: '/super-admin/companies/new', icon: Plus },
    ],
  },
  { label: 'Governance', icon: FileText, items: [{ name: 'Audit logs', href: '/super-admin/audit-logs', icon: FileText }] },
  {
    label: 'Platform',
    icon: Layers,
    items: [
      { name: 'Plans', href: '/super-admin/plans', icon: Layers },
      { name: 'Themes', href: '/super-admin/themes', icon: Palette },
      { name: 'System', href: '/super-admin/system', icon: ServerCog },
    ],
  },
];

const THEME_CACHE_KEY = 'sa-theme-tokens';

/** The Super Admin's menu style (Profile → Menu style), cached so a reload doesn't flash Classic first. */
function useMenuStyle(prefs: UserPreferences | undefined, userId: string | undefined): MenuStyle {
  const [cached, setCached] = useState<MenuStyle | null>(null);
  const key = `sa-menu-style-${userId}`;
  const style = prefs ? (prefs.menuStyle ?? 'classic') : null;
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

/**
 * Applies the Super Admin portal theme. The last theme is cached per browser
 * so it paints immediately on reload, then refreshed from the API.
 */
function PortalTheme({ enabled }: { enabled: boolean }) {
  const settings = useThemeSettings({ enabled });
  const [cached, setCached] = useState<ThemeTokens | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(THEME_CACHE_KEY);
      if (raw) setCached(JSON.parse(raw) as ThemeTokens);
    } catch {
      /* storage unavailable or corrupt */
    }
  }, []);

  const tokens = settings.data ? resolveTheme(settings.data.superAdminTheme, settings.data.customTokens) : cached;

  useEffect(() => {
    if (!settings.data || !tokens) return;
    try {
      localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(tokens));
    } catch {
      /* storage unavailable */
    }
  }, [settings.data, tokens]);

  return <ThemeStyle tokens={tokens} />;
}

const SEGMENT_LABELS: Record<string, string> = {
  'super-admin': 'Platform',
  companies: 'Companies',
  new: 'Onboard',
  'audit-logs': 'Audit logs',
  themes: 'Themes',
  editor: 'Editor',
  plans: 'Plans',
  system: 'System',
  profile: 'Profile & security',
};


/** Ctrl/⌘+K, "/", "?" and "g" + key navigation. Ignored while typing in a field. */
function useShortcuts(handlers: { onCommand: () => void; onHelp: () => void; onGo: (href: string) => void }) {
  const pendingG = useRef<number | null>(null);

  useEffect(() => {
    const isTyping = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handlers.onCommand();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;

      if (e.key === '/') {
        const search = document.querySelector<HTMLInputElement>('[data-page-search]');
        if (search) {
          e.preventDefault();
          search.focus();
        }
      } else if (e.key === '?') {
        handlers.onHelp();
      } else if (pendingG.current !== null) {
        const nav = NAV_SHORTCUTS.find((n) => n.key === e.key.toLowerCase());
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        if (nav) handlers.onGo(nav.href);
      } else if (e.key.toLowerCase() === 'g') {
        pendingG.current = window.setTimeout(() => (pendingG.current = null), 1000);
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handlers]);
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const prefs = usePreferences();
  const menuStyle = useMenuStyle(prefs.data, user?.id);

  const allowed = hydrated && isAuthenticated && Boolean(user?.isSuperAdmin) && !user?.mustChangePassword;

  // ── Route guard ────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !user) {
      router.replace(withNext('/platform/login', pathname));
    } else if (user.isSuperAdmin && user.mustChangePassword) {
      router.replace(changePasswordPath(user, pathname));
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

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem('sa-sidebar-collapsed', c ? '0' : '1');
      } catch {
        /* storage unavailable */
      }
      return !c;
    });

  const handleLogout = useCallback(() => {
    logout();
    router.replace('/platform/login');
  }, [logout, router]);

  const shortcutHandlers = useRef({
    onCommand: () => setCommandOpen((o) => !o),
    onHelp: () => setHelpOpen(true),
    onGo: (href: string) => router.push(href),
  }).current;
  useShortcuts(shortcutHandlers);
  // Profile & security → Sign me out after inactivity
  useIdleSignOut(allowed ? prefs.data?.idleTimeoutMinutes : null, () => {
    logout();
    router.replace('/platform/login?reason=idle');
  });

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <PortalTheme enabled={false} />
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fullName = `${user!.firstName} ${user!.lastName}`;
  // Classic can be collapsed to icons
  const compact = menuStyle === 'classic' && collapsed;

  return (
    <div className="isolate flex min-h-screen bg-canvas text-foreground">
      <PageBackdrop platform />
      <PortalTheme enabled />
      <DisplayPreferences />
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden animate-in fade-in-0" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 ease-out',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          compact ? 'lg:w-[60px]' : 'lg:w-60',
          menuStyle === 'floating' && 'lg:top-3 lg:m-3 lg:mr-0 lg:h-[calc(100vh-1.5rem)] lg:rounded-2xl lg:border lg:shadow-card',
          mobileOpen ? 'w-60 translate-x-0' : 'w-60 -translate-x-full',
        )}
      >
        {/* Workspace */}
        <div className={cn('flex h-14 items-center gap-2.5 px-3', compact && 'lg:justify-center lg:px-0')}>
          <Link href="/super-admin" className="flex min-w-0 items-center gap-2.5 rounded-md">
            <span className="m-shine flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-card shadow-inner-highlight">
              <ShieldCheck className="h-[18px] w-[18px]" />
            </span>
            <span className={cn('min-w-0 leading-tight', compact && 'lg:hidden')}>
              <span className="block truncate text-sm font-semibold text-foreground">HRMS Platform</span>
              <span className="block truncate text-2xs text-sidebar-muted">Super Admin console</span>
            </span>
          </Link>
          <button className="ml-auto rounded-md p-1.5 hover:bg-sidebar-active lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search shortcut */}
        <div className={cn('px-3 pb-2', compact && 'lg:px-2')}>
          <Tooltip content="Search" shortcut="Ctrl K" side="right" disabled={!compact}>
            <button
              onClick={() => setCommandOpen(true)}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border bg-background/60 px-2.5 text-xs text-sidebar-muted transition-colors hover:border-foreground/15 hover:text-sidebar-foreground',
                compact && 'lg:justify-center lg:px-0',
              )}
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className={cn('flex-1 text-left', compact && 'lg:hidden')}>Search…</span>
              <span className={cn('flex gap-0.5', compact && 'lg:hidden')}>
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
          </Tooltip>
        </div>

        {menuStyle === 'floating' ? (
          <FloatingNav groups={NAV_GROUPS} pathname={pathname} />
        ) : menuStyle === 'collapsible' ? (
          <CollapsibleNav groups={NAV_GROUPS} pathname={pathname} />
        ) : (
          <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-4">
                <p className={cn('mb-1 px-2 text-2xs font-medium uppercase tracking-wider text-sidebar-muted', compact && 'lg:invisible lg:h-0 lg:mb-0')}>
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map(({ name, href, icon: Icon, exact }) => {
                    const active = exact ? pathname === href : pathname.startsWith(href);
                    return (
                      <li key={href}>
                        <Tooltip content={name} side="right" disabled={!compact}>
                          <Link
                            href={href}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors',
                              compact && 'lg:justify-center lg:px-0',
                              active
                                ? 'bg-sidebar-active text-sidebar-active-foreground'
                                : 'text-sidebar-foreground hover:bg-sidebar-active/60 hover:text-sidebar-active-foreground',
                            )}
                          >
                            {active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" aria-hidden />}
                            <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-sidebar-muted group-hover:text-sidebar-foreground')} />
                            <span className={cn('truncate', compact && 'lg:hidden')}>{name}</span>
                          </Link>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        )}

        {/* User card */}
        <div className="border-t border-sidebar-border p-2">
          <DropdownMenu
            align="left"
            label={user!.email}
            trigger={() => (
              <button
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-sidebar-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  compact && 'lg:justify-center',
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-xs font-semibold text-primary-foreground">
                  {initials(fullName)}
                </span>
                <span className={cn('min-w-0 flex-1 leading-tight', compact && 'lg:hidden')}>
                  <span className="block truncate text-[13px] font-medium text-foreground">{fullName}</span>
                  <span className="block truncate text-2xs text-sidebar-muted">Super Admin</span>
                </span>
                <ChevronsUpDown className={cn('h-3.5 w-3.5 text-sidebar-muted', compact && 'lg:hidden')} />
              </button>
            )}
            items={[
              { label: 'Profile & security', icon: <UserCircle />, onSelect: () => router.push('/super-admin/profile') },
              { label: 'Keyboard shortcuts', icon: <Keyboard />, shortcut: '?', onSelect: () => setHelpOpen(true) },
              'separator',
              { label: 'Sign out', icon: <LogOut />, danger: true, onSelect: handleLogout },
            ]}
          />
          {menuStyle === 'classic' && (
          <button
            onClick={toggleCollapsed}
            className="mt-1 hidden h-7 w-full items-center justify-center gap-2 rounded-md text-2xs text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground lg:flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <><PanelLeftClose className="h-3.5 w-3.5" /> Collapse</>}
          </button>
          )}
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
          <div className="flex items-center gap-1.5">
            <LiveConnection />
            <LiveDot className="mr-0.5" />
            <SystemPill />
            <QueueButton />
            <Tooltip content="Search" shortcut="Ctrl K">
              <button
                onClick={() => setCommandOpen(true)}
                aria-label="Open command menu"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground lg:hidden"
              >
                <Search className="h-4 w-4" />
              </button>
            </Tooltip>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className={cn('mx-auto animate-fade-up', pathname === '/super-admin' ? 'max-w-[1500px]' : 'max-w-6xl')} key={pathname}>
            {children}
          </div>
        </main>
      </div>

      <ReauthDialog />
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} onLogout={handleLogout} onShowShortcuts={() => setHelpOpen(true)} />
      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
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
        const label = SEGMENT_LABELS[seg] ?? (/^[0-9a-f-]{36}$/.test(seg) ? 'Details' : seg);
        return (
          <React.Fragment key={href}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
            {last ? (
              <span className="truncate font-medium text-foreground">{label}</span>
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

/** Health dot reflecting platform status; links to the System page. */
function SystemPill() {
  const { data, isError } = useSystemStatus({ refetchInterval: 60_000 });
  const ok = !isError && data?.health.status === 'ok';
  return (
    <Tooltip content={data ? (ok ? 'All systems operational' : 'Some services are unavailable') : 'Checking system status…'}>
      <Link
        href="/super-admin/system"
        className="hidden h-8 items-center gap-2 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground sm:flex"
      >
        <span className="relative flex h-2 w-2">
          {data && <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-50', ok ? 'bg-success' : 'bg-destructive')} />}
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', !data ? 'bg-muted-foreground' : ok ? 'bg-success' : 'bg-destructive')} />
        </span>
        {data ? (ok ? 'Operational' : 'Degraded') : 'Checking'}
      </Link>
    </Tooltip>
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
    <Tooltip content="Open Bull Board">
      <button
        onClick={onClick}
        className="hidden h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground md:flex"
      >
        <Activity className="h-3.5 w-3.5" /> Queues <ExternalLink className="h-3 w-3 opacity-60" />
      </button>
    </Tooltip>
  );
}
