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
  Palette,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import type { ThemeTokens } from '@hrms/types';
import { useAuthStore } from '@/store/useAuthStore';
import { DisplayPreferences } from '@/components/preferences/display-preferences';
import { changePasswordPath, loginPathFor, useAuthHydrated, withNext } from '@/lib/auth/portal';
import { ThemeToggle } from '@/components/ui/theme-toggle';
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
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  { label: 'Overview', items: [{ name: 'Dashboard', href: '/app', icon: LayoutDashboard, exact: true }] },
  {
    label: 'Organization',
    items: [
      { name: 'Employees', href: '/app/employees', icon: Users, soon: true },
      { name: 'Departments', href: '/app/departments', icon: Building2, soon: true },
      { name: 'Designations', href: '/app/designations', icon: Briefcase, soon: true },
      { name: 'Locations', href: '/app/locations', icon: MapPin, soon: true },
    ],
  },
  {
    label: 'Settings',
    items: [
      { name: 'Branding', href: '/app/settings/branding', icon: ImageIcon, permission: 'branding.manage' },
      { name: 'Theme', href: '/app/settings/theme', icon: Palette, permission: 'branding.manage' },
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
  const { user, companyId, isAuthenticated, permissions, logout } = useAuthStore();
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

  const can = (permission?: string) => !permission || user!.isSuperAdmin || permissions.includes(permission);
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
            const items = group.items.filter((i) => can(i.permission));
            if (!items.length) return null;
            return (
              <div key={group.label} className="mb-4">
                <p className="mb-1 px-2 text-2xs font-medium uppercase tracking-wider text-sidebar-muted">{group.label}</p>
                <ul className="space-y-0.5">
                  {items.map(({ name, href, icon: Icon, exact, soon }) => {
                    const active = exact ? pathname === href : pathname.startsWith(href);
                    const content = (
                      <>
                        {active && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" aria-hidden />}
                        <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-sidebar-muted')} />
                        <span className="flex-1 truncate">{name}</span>
                        {soon && <Badge className="px-1.5 py-0 text-2xs">Soon</Badge>}
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
          <ThemeToggle />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl animate-fade-up" key={pathname}>
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
        const label = SEGMENT_LABELS[seg] ?? seg;
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
