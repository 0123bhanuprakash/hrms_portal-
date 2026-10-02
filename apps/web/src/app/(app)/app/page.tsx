'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  Building2,
  Cake,
  CalendarDays,
  Clock,
  Home,
  IdCard,
  ImageIcon,
  Network,
  Palette,
  PartyPopper,
  Plane,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';
import { Card, CardHeader, Skeleton, Tabs } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { PersonAvatar, PersonRow } from '@/components/profile/person-avatar';
import { CompletionCard } from '@/components/profile/profile-header';
import { useAuthStore } from '@/store/useAuthStore';
import { useAccess } from '@/lib/access/use-access';
import { useCompanyBranding, useCompanyStats } from '@/lib/company/queries';
import { useMyCard, useSpotlight, type Spotlight } from '@/lib/company/profile';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** "MM-DD" → "12 Oct" */
const monthDay = (md: string) => {
  const [m, d] = md.split('-').map(Number);
  return new Date(2000, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};
const inDays = (n: number) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`);

export default function HomePage() {
  const { user, companyId } = useAuthStore();
  const { can, scopeOf, hasFeature, isOwner } = useAccess();
  const branding = useCompanyBranding(companyId);
  const me = useMyCard();
  const spotlight = useSpotlight(can('org.view'));
  const employee = me.data?.employee;

  // Company-wide numbers for people who manage the company, not for everyone
  const showStats = Boolean(user?.isSuperAdmin || isOwner || can('user.view') || scopeOf('employee.view') === 'company');
  const stats = useCompanyStats(showStats ? companyId : null);
  const s = stats.data;

  const quick = [
    { href: '/app/profile', icon: IdCard, title: 'My profile', text: 'Personal, bank & documents', show: Boolean(employee) },
    { href: '/app/people', icon: Users, title: 'People', text: 'Find a colleague', show: can('org.view') && hasFeature('people.directory') },
    { href: '/app/org', icon: Network, title: 'Org chart', text: 'Teams and reporting lines', show: can('org.view') },
    { href: '/app/employees', icon: UsersRound, title: 'Employees', text: 'Manage employee records', show: can('employee.view') && scopeOf('employee.view') !== 'own' },
  ].filter((q) => q.show);
  const soon = [
    { icon: Clock, title: 'Check in', show: hasFeature('time.attendance') },
    { icon: Plane, title: 'Apply leave', show: hasFeature('time.leave') },
    { icon: Home, title: 'Work from home', show: hasFeature('time.leave') },
  ].filter((q) => q.show);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${greeting()}, ${user?.firstName ?? ''}`}
        description={branding.data?.displayName ? `Welcome to ${branding.data.displayName}.` : 'Your HR workspace at a glance.'}
      />

      {showStats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Employees" value={s?.employeeCount} icon={<Users />} />
          <StatCard title="Departments" value={s?.departmentCount} icon={<Building2 />} tone="info" />
          <StatCard title="Portal users" value={s?.userCount} icon={<UsersRound />} tone="neutral" />
          <StatCard title="Active users" value={s?.activeUserCount} icon={<UserCheck />} tone="success" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {me.data?.completion && me.data.completion.percent < 100 && <CompletionCard completion={me.data.completion} href="/app/profile" compact />}

          <Card>
            <CardHeader title="Quick actions" />
            <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
              {quick.map(({ href, icon: Icon, title, text }) => (
                <Link key={href} href={href} className="group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/60">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{text}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </Link>
              ))}
              {soon.map(({ icon: Icon, title }) => (
                <div key={title} className="flex items-center gap-3 rounded-lg p-2.5 opacity-60" aria-disabled>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium">{title}</span>
                  <Badge>Soon</Badge>
                </div>
              ))}
            </div>
          </Card>

          {can('org.view') && <SpotlightCard data={spotlight.data} loading={spotlight.isLoading} />}
        </div>

        <div className="space-y-4">
          {employee && (employee.reportingManager || employee.subordinates.length > 0) && (
            <Card>
              <CardHeader icon={<Users />} title="My team" />
              <div className="space-y-4 px-5 pb-5">
                {employee.reportingManager && (
                  <div>
                    <p className="mb-1.5 text-xs text-muted-foreground">Reports to</p>
                    <PersonRow person={employee.reportingManager} />
                  </div>
                )}
                {employee.subordinates.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">Direct reports · {employee.directReportCount}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {employee.subordinates.map((p) => (
                        <span key={p.id} title={`${p.firstName} ${p.lastName}`}>
                          <PersonAvatar person={p} size="sm" />
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {can('org.view') && <HolidaysCard data={spotlight.data} loading={spotlight.isLoading} />}

          <Card>
            <CardHeader title="Make it yours" />
            <div className="space-y-1 px-3 pb-3">
              {[
                ...(user?.isSuperAdmin || can('branding.manage')
                  ? [
                      { href: '/app/settings/theme', icon: Palette, title: 'Theme', text: 'Colors, font, shapes' },
                      { href: '/app/settings/branding', icon: ImageIcon, title: 'Branding', text: 'Logo, favicon and name' },
                    ]
                  : []),
                { href: '/app/settings/preferences', icon: SlidersHorizontal, title: 'Preferences', text: 'Appearance, time zone, date format' },
              ].map(({ href, icon: Icon, title, text }) => (
                <Link key={href} href={href} className="group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/60">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{text}</span>
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Spotlight ──────────────────────────────────────────────

type SpotTab = 'birthdays' | 'anniversaries' | 'joiners';

function SpotlightCard({ data, loading }: { data?: Spotlight; loading: boolean }) {
  const [tab, setTab] = useState<SpotTab>('birthdays');
  const tabs: Array<{ id: SpotTab; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'birthdays', label: 'Birthdays', icon: <Cake />, count: data?.birthdays.length },
    { id: 'anniversaries', label: 'Work anniversaries', icon: <Award />, count: data?.anniversaries.length },
    { id: 'joiners', label: 'New joiners', icon: <UserPlus />, count: data?.newJoiners.length },
  ];

  const rows =
    tab === 'birthdays'
      ? data?.birthdays.map((p) => ({ p, right: monthDay(p.date), sub: inDays(p.inDays), highlight: p.inDays === 0 }))
      : tab === 'anniversaries'
        ? data?.anniversaries.map((p) => ({ p, right: `${p.years} yr${p.years === 1 ? '' : 's'}`, sub: `${inDays(p.inDays)} · ${monthDay(p.date)}`, highlight: p.inDays === 0 }))
        : data?.newJoiners.map((p) => ({ p, right: formatDate(p.joiningDate), sub: p.department?.name ?? '', highlight: false }));

  const empty = {
    birthdays: 'No birthdays in the next 30 days.',
    anniversaries: 'No work anniversaries in the next 30 days.',
    joiners: 'Nobody new in the last 30 days.',
  }[tab];

  return (
    <Card>
      <CardHeader icon={<Sparkles />} title="Spotlight" description="Celebrate your colleagues" />
      <div className="px-5">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </div>
      {loading ? (
        <div className="space-y-2 p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !rows?.length ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.slice(0, 8).map(({ p, right, sub, highlight }) => (
            <li key={p.id} className={cn('flex items-center gap-3 px-5 py-2.5', highlight && 'bg-primary-soft/40')}>
              <PersonAvatar person={p} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {p.firstName} {p.lastName} {highlight && <PartyPopper className="ml-1 inline h-3.5 w-3.5 text-primary" />}
                </p>
                <p className="truncate text-xs text-muted-foreground">{p.designation?.name ?? sub}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums">{right}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {tab === 'birthdays' && (
        <p className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
          Only people who chose to share their birthday appear here. <Link href="/app/profile" className="font-medium text-primary hover:underline">Change yours</Link>
        </p>
      )}
    </Card>
  );
}

function HolidaysCard({ data, loading }: { data?: Spotlight; loading: boolean }) {
  return (
    <Card>
      <CardHeader icon={<CalendarDays />} title="Upcoming holidays" />
      {loading ? (
        <div className="px-5 pb-5"><Skeleton className="h-16 w-full" /></div>
      ) : !data?.holidays.length ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">No holidays added yet.</p>
      ) : (
        <ul className="space-y-2.5 px-5 pb-5">
          {data.holidays.map((h) => {
            const d = new Date(h.date);
            return (
              <li key={h.id} className="flex items-center gap-3">
                <span className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-border py-1 leading-tight">
                  <span className="text-2xs font-medium uppercase text-muted-foreground">{d.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })}</span>
                  <span className="text-sm font-semibold tabular-nums">{d.getUTCDate()}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{h.name}</span>
                  <span className="block text-xs text-muted-foreground">{d.toLocaleDateString(undefined, { weekday: 'long', timeZone: 'UTC' })}</span>
                </span>
                {h.isOptional && <Badge>Optional</Badge>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
