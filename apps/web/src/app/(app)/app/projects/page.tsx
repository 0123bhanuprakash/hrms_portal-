'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Flag, FolderKanban, GanttChart, Kanban, LayoutGrid, Plus, Search, ShieldCheck, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, Pagination, Skeleton, Tabs } from '@/components/ui/feedback';
import { Input, inputClass } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { ProjectDialog } from '@/components/projects/project-dialog';
import { MyProjects } from '@/components/projects/my-projects';
import { ProjectTimeline } from '@/components/projects/project-timeline';
import { HEALTH, HealthPill, MilestoneBar, TypeBadge, daysFrom, projectColor, shortDate } from '@/components/projects/project-ui';
import { useAccess } from '@/lib/access/use-access';
import { PersonSearch } from '@/components/people/person-search';
import { PROJECT_STATUS, usePortfolio, usePortfolioSummary, type Health, type LimitedProject, type PortfolioProject, type PortfolioQuery, type ProjectStatus, type ProjectType } from '@/lib/company/projects';
import { useUiState } from '@/lib/preferences/ui-state';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/pickers';

type Tab = 'mine' | 'all';
type View = 'cards' | 'board' | 'timeline';
const isView = (v: unknown): v is View => v === 'cards' || v === 'board' || v === 'timeline';

function ProjectsContent() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const allowed = hasFeature('work.projects') && can('project.view');
  const pmo = can('project.manage');
  const tab: Tab = params.get('tab') === 'mine' || params.get('tab') === 'all' ? (params.get('tab') as Tab) : pmo ? 'all' : 'mine';
  const setTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });
  const [creating, setCreating] = useState(false);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="Projects aren’t available" description="Projects aren’t enabled for you." />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Work"
        title="Projects"
        description={tab === 'mine' ? 'What you’re on, who leads you there and what’s coming up.' : (pmo ? 'Every project, how it’s going and who is on it.' : 'Every project in the company. Details are shown for the ones you’re on.')}
        action={
          <div className="flex flex-wrap gap-2">
            {pmo && <Button variant="secondary" asChild><Link href="/app/projects/planner"><Users /> Resource planner</Link></Button>}
            {pmo && <Button onClick={() => setCreating(true)}><Plus /> New project</Button>}
          </div>
        }
      />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'mine', label: 'My projects' }, { id: 'all', label: 'All projects' }]} />
      {tab === 'mine' ? <MyProjects /> : <Portfolio pmo={pmo} />}
      {creating && <ProjectDialog value="new" onClose={() => setCreating(false)} onSaved={(p) => router.push(`/app/projects/${p.id}`)} />}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsContent />
    </Suspense>
  );
}

// ─── Portfolio ──────────────────────────────────────────────

function Portfolio({ pmo }: { pmo: boolean }) {
  const [view, setView] = useUiState<View>('projects:view', 'cards', isView);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [q, setQ] = useState<PortfolioQuery>({ sort: 'attention' });
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const [page, setPage] = useState(1);
  const shownView: View = pmo ? view : 'cards';
  // The board shows every column at once, so it takes up to 100; cards page by 24
  const query = { ...q, search: debounced || undefined, page: shownView === 'board' ? 1 : page, limit: shownView === 'board' ? 100 : 24 };
  // Any new filter starts again on page 1
  useEffect(() => setPage(1), [q, debounced, shownView]);
  const list = usePortfolio(query);
  const summary = usePortfolioSummary(pmo);
  const counts = (h: Health) => list.data?.meta.health[h as 'on_track' | 'at_risk' | 'off_track'] ?? 0;
  const rows = list.data?.data ?? [];
  const full = rows.filter((p): p is PortfolioProject => !p.limited);
  const limited = rows.filter((p): p is LimitedProject => p.limited);
  const s = summary.data;
  const change = s ? Math.round((s.billing.billablePct - s.billingLastMonth.billablePct) * 10) / 10 : 0;

  return (
    <div className="space-y-4">
      {s && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Kpi label="Active projects" value={String(s.active)} sub={s.startingThisMonth ? `${s.startingThisMonth} starting this month` : 'none starting this month'} />
          <Kpi label="Need attention" value={String(s.attention.total)} sub={`${s.attention.offTrack} off track · ${s.attention.atRisk} at risk`} tone={s.attention.total ? 'text-destructive' : 'text-success'} />
          <Kpi label="Milestones this month" value={String(s.milestonesThisMonth.total)} sub={`${s.milestonesThisMonth.done} done${s.milestonesThisMonth.overdue ? ` · ${s.milestonesThisMonth.overdue} overdue` : ''}`} tone={s.milestonesThisMonth.overdue ? 'text-warning' : undefined} />
          <Kpi label="People on projects" value={`${s.billing.onProjects} / ${s.billing.headcount}`} sub={`${s.billing.bench} on the bench`} />
          <Card className="col-span-2 p-4 md:col-span-1">
            <p className="text-xs text-muted-foreground">Billable today</p>
            <p className="text-2xl font-semibold tabular-nums">{s.billing.billablePct}%</p>
            <p className={cn('text-xs font-semibold', change > 0 ? 'text-success' : change < 0 ? 'text-destructive' : 'text-muted-foreground')}>
              {change === 0 ? 'same as a month ago' : `${change > 0 ? '+' : ''}${change} pts vs a month ago`} · investment {s.billing.investmentPct}%
            </p>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, code or client" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-8" aria-label="Search projects" />
        </div>
        {pmo && (['on_track', 'at_risk', 'off_track'] as Health[]).map((h) => (
          <button key={h} type="button" onClick={() => setQ({ ...q, health: q.health === h ? undefined : h })} aria-pressed={q.health === h} className={chip(q.health === h)}>
            {HEALTH[h].emoji} {HEALTH[h].label} · {counts(h)}
          </button>
        ))}
        <Select className={cn(inputClass, 'h-9 w-auto text-xs')} value={q.type ?? ''} onChange={(e) => setQ({ ...q, type: (e.target.value || undefined) as ProjectType | undefined })} aria-label="Type">
          <option value="">Client & internal</option>
          <option value="CLIENT">Client (billable)</option>
          <option value="INTERNAL">Internal (investment)</option>
        </Select>
        {pmo && <Select className={cn(inputClass, 'h-9 w-auto text-xs')} value={q.status ?? ''} onChange={(e) => setQ({ ...q, status: (e.target.value || undefined) as ProjectStatus | undefined })} aria-label="Status">
          <option value="">Any status</option>
          {Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>}
        {pmo && <PersonSearch className="w-44 text-xs" aria-label="Project manager" value={q.managerId ?? ''} onChange={(v) => setQ({ ...q, managerId: v || undefined })} emptyLabel="Any manager" />}
        {pmo && <Select className={cn(inputClass, 'h-9 w-auto text-xs')} value={q.sort} onChange={(e) => setQ({ ...q, sort: e.target.value as PortfolioQuery['sort'] })} aria-label="Sort">
          <option value="attention">Needs attention first</option>
          <option value="end">Ending soonest</option>
          <option value="start">Newest</option>
          <option value="name">Name A–Z</option>
        </Select>}
        {pmo && <div className="ml-auto inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="View">
          {([['cards', 'Cards', <LayoutGrid key="c" />], ['board', 'Board', <Kanban key="b" />], ['timeline', 'Timeline', <GanttChart key="t" />]] as const).map(([id, l, icon]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold [&_svg]:size-3.5', view === id ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {icon} {l}
            </button>
          ))}
        </div>}
      </div>

      {shownView === 'timeline' ? (
        <ProjectTimeline />
      ) : list.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}</div>
      ) : list.isError ? (
        <ErrorState message={getApiErrorMessage(list.error, 'Could not load projects')} onRetry={() => list.refetch()} />
      ) : !rows.length ? (
        <EmptyState icon={<FolderKanban />} title={debounced || q.health || q.type || q.status || q.managerId ? 'No projects match' : 'No projects yet'} description={pmo ? 'Create a project, then assign people with their role, team lead and allocation.' : 'Your PMO hasn’t set up any projects.'} />
      ) : shownView === 'board' ? (
        <>
          <Board projects={full} today={list.data!.meta.today} />
          {list.data!.meta.total > rows.length && <p className="text-center text-xs text-muted-foreground">Showing the first {rows.length} of {list.data!.meta.total} projects — search or filter to narrow the board, or switch to cards to page through all.</p>}
        </>
      ) : (
        <div className="space-y-5">
          {full.length > 0 && (
            <ul className="grid gap-3 lg:grid-cols-2">
              {full.map((p) => <li key={p.id}><ProjectCard p={p} today={list.data!.meta.today} /></li>)}
            </ul>
          )}
          {limited.length > 0 && (
            <section className="space-y-2">
              <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">Other projects in the company</h2>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {limited.map((p) => {
                  const color = projectColor(p);
                  return (
                    <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-[10px] font-black" style={{ background: `${color}1f`, color }}>{p.code.slice(0, 4)}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{p.name}</span><span className="block truncate text-xs text-muted-foreground">{p.clientName ?? 'Internal'}</span></span>
                      <TypeBadge type={p.type} />
                    </li>
                  );
                })}
              </ul>
              <p className="px-1 text-xs text-muted-foreground">You see the team, timeline and status of projects you’re on.</p>
            </section>
          )}
          {list.data!.meta.totalPages > 1 && (
            <Card className="overflow-hidden p-0">
              <Pagination page={list.data!.meta.page} totalPages={list.data!.meta.totalPages} total={list.data!.meta.total} limit={list.data!.meta.limit} onPageChange={setPage} />
            </Card>
          )}
        </div>
      )}
      {pmo && <p className="text-xs text-muted-foreground">
        <b>Health:</b> 🔴 past its end date or a milestone over a week late · 🟠 a milestone due within 7 days, an open role, or no project manager · 🟢 everything else. The PM can override it with a status update.
      </p>}
    </div>
  );
}

const chip = (on: boolean) => cn('inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors', on ? 'border-primary/40 bg-primary-soft text-primary-soft-foreground' : 'border-border bg-surface text-muted-foreground hover:text-foreground');

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className={cn('text-xs font-semibold text-muted-foreground', tone)}>{sub}</p>
    </Card>
  );
}

function ProjectCard({ p, today }: { p: PortfolioProject; today: string }) {
  const color = projectColor(p);
  const why = p.health.override ? `PM update: ${p.health.override.note}` : p.health.reasons[0] ?? (p.health.level === 'on_track' ? 'Milestones on time · fully staffed' : '');
  const next = p.milestones.next;
  const nextDays = next ? daysFrom(today, next.dueDate) : null;
  return (
    <Link href={`/app/projects/${p.id}`} className="group block h-full overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="block h-1.5" style={{ background: color }} />
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-mono text-[11px] font-black" style={{ background: `${color}1f`, color }}>{p.code.slice(0, 4)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold group-hover:text-primary">{p.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {p.clientName ?? 'Internal'} · {p.managers.length ? `PM ${p.managers.map((m) => m.firstName).join(', ')}` : <span className="text-warning">no PM</span>}
            </p>
          </div>
          <HealthPill health={p.health} />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Milestones <b className="text-foreground">{p.milestones.done} of {p.milestones.total}</b> done</span>
            {p.timePct !== null && <span>Time gone {p.timePct}%</span>}
          </div>
          <MilestoneBar done={p.milestones.done} total={p.milestones.total} timePct={p.timePct} color={color} />
        </div>
        {why && <p className={cn('truncate text-xs font-semibold', p.health.level === 'off_track' ? 'text-destructive' : p.health.level === 'at_risk' ? 'text-warning' : 'text-muted-foreground')} title={why}>{why}</p>}
        <div className="flex items-center gap-2 text-xs">
          <Flag className="h-3.5 w-3.5 text-muted-foreground" />
          {next ? <span><b>Next:</b> {next.title} · {nextDays! < 0 ? <span className="text-destructive">{-nextDays!} days late</span> : nextDays === 0 ? 'today' : shortDate(next.dueDate)}</span> : <span className="text-muted-foreground">No milestones yet</span>}
          <span className="ml-auto text-muted-foreground">{p.endDate ? (p.endDate < today ? `Was due ${shortDate(p.endDate)}` : `Ends ${shortDate(p.endDate)}`) : 'Ongoing'}</span>
        </div>
        <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="flex -space-x-2">{p.team.map((m) => <PersonAvatar key={m.id} person={m} size="xs" className="h-6 w-6 ring-2 ring-surface" />)}</span>
          <span>{p.memberCount} {p.memberCount === 1 ? 'person' : 'people'}{p.type === 'CLIENT' ? ` · ${p.billedCount} billed` : ''}{p.openRoles ? ` · ${p.openRoles} open role${p.openRoles === 1 ? '' : 's'}` : ''}</span>
          <TypeBadge type={p.type} className="ml-auto" />
        </div>
        {p.status === 'ACTIVE' && (
          <p className={cn('text-[11px]', p.health.updateOverdue ? 'font-semibold text-warning' : 'text-muted-foreground')}>
            {p.lastUpdate ? `PM update ${formatRelative(p.lastUpdate.at)}` : 'No PM update yet'}{p.health.updateOverdue ? ' · update overdue' : ''}
          </p>
        )}
      </div>
    </Link>
  );
}

function Board({ projects, today }: { projects: PortfolioProject[]; today: string }) {
  const lanes: Array<[ProjectStatus, string]> = [['PLANNED', 'bg-info'], ['ACTIVE', 'bg-success'], ['ON_HOLD', 'bg-warning'], ['COMPLETED', 'bg-muted-foreground']];
  return (
    <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
      {lanes.map(([status, dot]) => {
        const rows = projects.filter((p) => p.status === status);
        return (
          <section key={status} className="flex min-h-[14rem] flex-col gap-2 rounded-xl bg-muted/60 p-2.5">
            <h3 className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground"><span className="flex items-center gap-1.5"><i className={cn('h-2 w-2 rounded-full', dot)} />{PROJECT_STATUS[status].label}</span><span>{rows.length}</span></h3>
            {rows.map((p) => {
              const color = projectColor(p);
              return (
                <Link key={p.id} href={`/app/projects/${p.id}`} className="block space-y-2 rounded-lg border border-border bg-surface p-3 shadow-card transition-shadow hover:shadow-md" style={{ borderLeft: `4px solid ${color}` }}>
                  <div className="flex items-start justify-between gap-2"><b className="text-sm leading-tight">{p.name}</b>{status === 'ACTIVE' && <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', HEALTH[p.health.level].dot)} title={HEALTH[p.health.level].label} />}</div>
                  <MilestoneBar done={p.milestones.done} total={p.milestones.total} timePct={p.timePct} color={color} />
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="flex -space-x-1.5">{p.team.slice(0, 3).map((m) => <PersonAvatar key={m.id} person={m} size="xs" className="h-5 w-5 ring-2 ring-surface" />)}</span>
                    {p.type === 'CLIENT' ? '💼' : '🏢'}
                    <span className="ml-auto">{p.endDate ? (p.endDate < today ? `due ${shortDate(p.endDate)}` : `ends ${shortDate(p.endDate)}`) : 'ongoing'}</span>
                  </div>
                </Link>
              );
            })}
            {!rows.length && <p className="px-1 py-6 text-center text-xs text-muted-foreground">Nothing here</p>}
          </section>
        );
      })}
    </div>
  );
}
