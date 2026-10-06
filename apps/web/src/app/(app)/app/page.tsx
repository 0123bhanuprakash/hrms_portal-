'use client';

import { CompleteProfileNudge } from '@/components/profile/no-profile';
import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  FolderKanban,
  Receipt,
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  Home,
  IdCard,
  ImageIcon,
  Megaphone,
  Network,
  Palette,
  Plane,
  SlidersHorizontal,
  UserPlus,
  Users,
  UsersRound,
  PackageCheck,
  LifeBuoy,
  Timer,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/feedback';
import { PersonAvatar, PersonRow } from '@/components/profile/person-avatar';
import { NeedsActionCard, TodayCard, useNeedsAction } from '@/components/dashboard/employee-sections';
import { AdminActionsCard, ApprovalsCard, AttendanceTodayCard, DepartmentsCard, JoinersCard, ProbationCard, WhosOffCard, useApprovals, useCompanyToday } from '@/components/dashboard/admin-sections';
import { CelebrationsCard, ComingUpCard, HomeHero, KudosTickerCard, LeaveBalanceCard, MyProjectsCard, MyWeekCard, greeting, useEmployeeHero, type HeroAction, type HeroStat } from '@/components/dashboard/home-sections';
import { HomeAnnouncements } from '@/components/engagement/home-cards';
import { useAuthStore } from '@/store/useAuthStore';
import { useAccess } from '@/lib/access/use-access';
import { useCompanyBranding, useCompanyStats } from '@/lib/company/queries';
import { useMyCard, useSpotlight } from '@/lib/company/profile';
import { cn } from '@/lib/cn';
import { useMoment } from '@/components/motion/moments';
import { useToday } from '@/lib/company/attendance';
import { SeasonBanner, useSeasonLook } from '@/components/season/season';
import { useHomeHidden } from '@/components/preferences/home-cards';

export default function HomePage() {
  const { user, companyId } = useAuthStore();
  const { can, scopeOf, hasFeature, isOwner } = useAccess();
  const me = useMyCard();
  const spotlight = useSpotlight(can('org.view'));
  const employee = me.data?.employee;
  const isEmployee = Boolean(employee);

  // Company-wide numbers for people who manage the company, not for everyone
  const showStats = Boolean(user?.isSuperAdmin || isOwner || can('user.view') || scopeOf('employee.view') === 'company');
  const stats = useCompanyStats(showStats ? companyId : null);
  const companyToday = useCompanyToday();
  const approvals = useApprovals();
  const needs = useNeedsAction(me.data);
  const celebrating = [...(spotlight.data?.birthdays ?? []), ...(spotlight.data?.anniversaries ?? [])].filter((p) => p.inDays === 0).map((p) => p.firstName);
  const employeeHero = useEmployeeHero(needs.loading ? undefined : needs.rows.length, [...new Set(celebrating)]);

  const quick = [
    { href: '/app/profile', icon: IdCard, title: 'My profile', text: 'Personal, bank & documents', show: isEmployee },
    { href: '/app/people', icon: Users, title: 'People', text: 'Find a colleague', show: can('org.view') && hasFeature('people.directory') },
    { href: '/app/org', icon: Network, title: 'Org chart', text: 'Teams and reporting lines', show: can('org.view') },
    { href: '/app/projects', icon: FolderKanban, title: 'Projects', text: can('project.manage') ? 'Create projects, allocate people' : 'Who works on what', show: hasFeature('work.projects') && can('project.view') },
    { href: '/app/attendance', icon: CalendarCheck, title: 'My attendance', text: 'Calendar and corrections', show: isEmployee && hasFeature('time.attendance') && can('attendance.view') },
    { href: '/app/leave?apply=', icon: Plane, title: 'Apply leave', text: 'Casual, sick, earned and more', show: isEmployee && hasFeature('time.leave') && can('leave.request') },
    { href: '/app/leave?apply=WFH', icon: Home, title: 'Work from home', text: 'Request a WFH day', show: isEmployee && hasFeature('time.leave') && can('leave.request') },
    { href: '/app/expenses', icon: Receipt, title: 'Claim expenses', text: 'Get reimbursed for work spend', show: isEmployee && hasFeature('ops.expenses') && can('expense.submit') },
    { href: '/app/assets/mine', icon: PackageCheck, title: 'My assets', text: 'Your equipment, or request something', show: isEmployee && hasFeature('ops.assets') && can('asset.view') },
    { href: '/app/helpdesk', icon: LifeBuoy, title: 'Get help', text: 'Raise a ticket to IT, HR or Finance', show: isEmployee && hasFeature('ops.helpdesk') && can('ticket.create') },
    { href: '/app/timesheets', icon: Timer, title: 'Timesheet', text: 'Log today’s work', show: isEmployee && hasFeature('work.timesheets') && can('timesheet.submit') },
    { href: '/app/leave/approvals', icon: CalendarClock, title: 'Leave approvals', text: 'Requests waiting for you', show: hasFeature('time.leave') && can('leave.approve') },
    { href: '/app/attendance/approvals', icon: ClipboardCheck, title: 'Attendance approvals', text: 'Corrections waiting for you', show: hasFeature('time.attendance') && can('attendance.approve') },
    { href: '/app/employees', icon: UsersRound, title: 'Employees', text: 'Manage employee records', show: can('employee.view') && scopeOf('employee.view') !== 'own' },
  ].filter((q) => q.show);

  // ── Hero ───────────────────────────────────────────────────
  let hero: { title: string; subtitle?: string; stats: HeroStat[]; actions: HeroAction[] };
  if (showStats) {
    const c = companyToday.counts;
    const s = stats.data;
    const parts: string[] = [];
    if (c && companyToday.present !== undefined) parts.push(c.total ? `${companyToday.present} of ${c.total} people are in.` : 'Not a working day today.');
    if (approvals.total !== undefined) parts.push(approvals.total ? `${approvals.total} approval${approvals.total === 1 ? '' : 's'} waiting for you.` : 'No approvals waiting.');
    if (celebrating.length) parts.push(`${celebrating.length} ${celebrating.length === 1 ? 'person is' : 'people are'} celebrating today.`);
    const actions: HeroAction[] = [];
    if (can('employee.create')) actions.push({ href: '/app/employees', label: 'Add employee', icon: <UserPlus />, primary: true });
    if (hasFeature('engage.announcements') && can('announcement.post')) actions.push({ href: '/app/announcements', label: 'Post announcement', icon: <Megaphone /> });
    if (hasFeature('insights.reports') && can('report.view')) actions.push({ href: '/app/reports', label: 'Reports', icon: <BarChart3 /> });
    actions.push(...employeeHero.actions.filter((a) => a.label !== 'Timesheet').map((a) => ({ ...a, primary: false })));
    hero = {
      title: `${greeting()}, ${user?.firstName ?? ''}`,
      subtitle: parts.join(' '),
      stats: [
        { label: 'Employees', value: s?.employeeCount, suffix: s ? `· ${s.departmentCount} depts` : undefined },
        ...(companyToday.enabled
          ? [
              { label: 'Present today', value: companyToday.present, suffix: c ? `/ ${c.total}` : undefined },
              { label: 'On leave', value: c?.onLeave, suffix: c ? `· ${c.workFromHome} WFH` : undefined },
            ]
          : []),
        { label: 'Waiting for you', value: approvals.total, tone: approvals.total ? 'warn' : undefined },
      ],
      actions: actions.slice(0, 4),
    };
  } else {
    hero = employeeHero;
  }

  // Atmosphere: your birthday / anniversary, festivals, monsoon, Friday, office lights for admins
  const branding = useCompanyBranding(companyId);
  const today = useToday(hasFeature('time.attendance'));
  const moment = useMoment({
    spotlight: spotlight.data,
    myEmployeeId: employee?.id,
    firstName: user?.firstName,
    companyName: branding.data?.displayName,
    shiftEnd: today.data?.policy.shiftEnd,
    office: showStats && companyToday.counts && companyToday.present !== undefined ? { present: companyToday.present + companyToday.counts.workFromHome, total: companyToday.counts.total } : undefined,
  });

  // Next to the hero: company attendance for admins, my day for everyone else
  const myDay = isEmployee && hasFeature('time.attendance') && can('attendance.mark');
  const heroSide = showStats && companyToday.enabled ? <AttendanceTodayCard className="h-full" /> : myDay ? <TodayCard /> : null;

  const team = employee && (employee.reportingManager || employee.subordinates.length > 0) && (
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
  );

  const quickCard = quick.length > 0 && (
    <Card>
      <CardHeader title="Quick actions" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2 px-4 pb-4">
        {quick.map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href} className="m-lift group flex items-center gap-3 rounded-lg border border-border p-2.5 transition-colors hover:border-foreground/20 hover:bg-subtle">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{title}</span>
              <span className="block truncate text-xs text-muted-foreground">{text}</span>
            </span>
            <ArrowRight className="h-4 w-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </Card>
  );

  const makeItYours = (
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
          { href: '/app/settings/preferences', icon: SlidersHorizontal, title: 'Preferences', text: 'Theme, menu style, time zone' },
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
  );

  const look = useSeasonLook();
  const hidden = useHomeHidden();
  const celebrations = can('org.view') && !hidden.has('celebrations') && <CelebrationsCard data={spotlight.data} loading={spotlight.isLoading} />;
  const comingUp = can('org.view') && !hidden.has('comingup') && <ComingUpCard data={spotlight.data} loading={spotlight.isLoading} />;

  return (
    <div className="space-y-5">
      {look.season && <SeasonBanner season={look.season} firstName={user?.firstName} />}
      <CompleteProfileNudge />
      {/* Hero + today */}
      <div className={cn('m-stagger grid gap-5', heroSide && 'lg:grid-cols-12')}>
        <HomeHero className={cn(heroSide && 'lg:col-span-8')} title={hero.title} subtitle={hero.subtitle} stats={hero.stats} actions={hero.actions} moment={moment} />
        {heroSide && <div className="min-w-0 lg:col-span-4 [&>*]:h-full">{heroSide}</div>}
      </div>

      {/* Main + side columns; the last card in each column stretches so both end level */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="m-stagger flex min-w-0 flex-col gap-5 lg:col-span-8 [&>*:last-child]:flex-1">
          {showStats ? (
            <>
              <ApprovalsCard />
              {isEmployee && hasFeature('time.attendance') && can('attendance.view') && <MyWeekCard />}
              <Pair>
                {!hidden.has('whosoff') && <WhosOffCard />}
                <DepartmentsCard />
              </Pair>
              {!hidden.has('joiners') && <JoinersCard />}
              <Pair>
                {isEmployee && <NeedsActionCard me={me.data} />}
                <ProbationCard />
              </Pair>
              {quickCard}
            </>
          ) : (
            <>
              {isEmployee && hasFeature('time.attendance') && can('attendance.view') && <MyWeekCard />}
              {isEmployee && hasFeature('time.leave') && can('leave.view') && <LeaveBalanceCard />}
              <Pair>
                {isEmployee && <NeedsActionCard me={me.data} />}
                <MyProjectsCard />
              </Pair>
              <ApprovalsCard />
              {quickCard}
            </>
          )}
        </div>
        <div className="m-stagger flex min-w-0 flex-col gap-5 lg:col-span-4 [&>*:last-child]:flex-1">
          {celebrations}
          {showStats && myDay && companyToday.enabled && <TodayCard />}
          {showStats && <AdminActionsCard />}
          {comingUp}
          {team}
          {makeItYours}
          {!hidden.has('kudos') && <KudosTickerCard />}
        </div>
      </div>

      {!hidden.has('announcements') && <HomeAnnouncements />}
    </div>
  );
}

/** Two cards side by side at equal height; one card alone takes the full row. */
function Pair({ children }: { children: React.ReactNode }) {
  return <div className="grid items-stretch gap-5 empty:hidden md:grid-cols-2 [&>*:only-child]:md:col-span-2">{children}</div>;
}
