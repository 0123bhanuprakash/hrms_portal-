'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Search, ShieldCheck, UserPlus, Users, Zap } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, EmptyState, ErrorState, LoadMore, Pagination, Skeleton } from '@/components/ui/feedback';
import { Field, Input, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { AssignDialog, type AssignRequest } from '@/components/projects/assign-dialog';
import { projectColor, shortDate } from '@/components/projects/project-ui';
import { useAccess } from '@/lib/access/use-access';
import { useDepartments } from '@/lib/company/org';
import { useAvailable, usePlanner, type PlannerCell, type PlannerShow, type ProjectPerson } from '@/lib/company/projects';
import { FilterChips } from '@/components/ui/list-tools';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { DateInput, Select } from '@/components/ui/pickers';

const addDays = (k: string, n: number) => {
  const d = new Date(`${k}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const tone = (v: number) =>
  v >= 100 ? 'bg-success-soft text-success' : v >= 50 ? 'bg-primary-soft text-primary-soft-foreground' : v > 0 ? 'bg-warning-soft text-warning' : 'bg-muted/60 text-muted-foreground';

function PlannerContent() {
  const { can, hasFeature, isLoading } = useAccess();
  const params = useSearchParams();
  const allowed = hasFeature('work.projects') && can('project.manage');
  const [from, setFrom] = useState<string | undefined>();
  const [weeks, setWeeks] = useState(8);
  const [departmentId, setDepartmentId] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cell, setCell] = useState<{ person: ProjectPerson; cell: PlannerCell } | null>(null);
  const [assign, setAssign] = useState<AssignRequest | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const [show, setShow] = useState<PlannerShow>('all');
  const [page, setPage] = useState(1);
  // Any new filter starts again on page 1
  useEffect(() => setPage(1), [from, weeks, departmentId, debounced, show]);
  const q = usePlanner({ from, weeks, departmentId: departmentId || undefined, search: debounced || undefined, show, page }, allowed);
  const departments = useDepartments();
  const focusRole = params.get('role');

  if (!isLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="Only the PMO can plan resources" />;
  const d = q.data;

  return (
    <div className="space-y-5">
      <div><Button variant="ghost" size="sm" asChild><Link href="/app/projects?tab=all"><ArrowLeft /> Projects</Link></Button></div>
      <PageHeader eyebrow="Work · PMO" title="Resource planner" description="Who is booked, who is free — week by week. Click a cell to see or change someone’s projects." />

      {d && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Fully booked', d.counts.full, 'bg-success', 'this week'],
            ['Partly booked', d.counts.partly, 'bg-primary', 'this week'],
            ['Free', d.counts.free, 'bg-muted-foreground/40', 'this week'],
            ['On the bench next month', d.counts.benchNextMonth, 'bg-warning', 'nothing booked in 30 days'],
          ].map(([l, v, dot, sub]) => (
            <Card key={l as string} className="flex items-center gap-3 p-4">
              <span className={cn('h-3 w-3 rounded', dot as string)} />
              <div><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-semibold tabular-nums">{v as number} <span className="text-xs font-normal text-muted-foreground">{sub}</span></p></div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="secondary" aria-label="Earlier" onClick={() => setFrom(addDays(d?.from ?? new Date().toISOString().slice(0, 10), -7 * Math.max(1, Math.floor(weeks / 2))))}><ChevronLeft /></Button>
        <Button size="icon-sm" variant="secondary" aria-label="Later" onClick={() => setFrom(addDays(d?.from ?? new Date().toISOString().slice(0, 10), 7 * Math.max(1, Math.floor(weeks / 2))))}><ChevronRight /></Button>
        <Button size="sm" variant="ghost" onClick={() => setFrom(undefined)}>This week</Button>
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a person" className="h-9 pl-8" aria-label="Find a person" />
        </div>
        <Select className={cn(inputClass, 'h-9 w-auto text-xs')} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {departments.data?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Select>
        {d && (
          <FilterChips
            label="Show"
            value={show}
            onChange={setShow}
            options={[
              { key: 'all', label: 'Everyone', count: d.counts.all },
              { key: 'full', label: 'Fully booked', count: d.counts.full },
              { key: 'partly', label: 'Partly booked', count: d.counts.partly },
              { key: 'free', label: 'Free', count: d.counts.free },
              { key: 'bench', label: 'Bench next month', count: d.counts.benchNextMonth },
            ]}
          />
        )}
        <div className="ml-auto inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Weeks">
          {[4, 8, 13].map((w) => (
            <button key={w} type="button" aria-pressed={weeks === w} onClick={() => setWeeks(w)} className={cn('h-7 rounded-md px-3 text-xs font-semibold', weeks === w ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground')}>{w === 13 ? 'Quarter' : `${w} weeks`}</button>
          ))}
        </div>
      </div>

      {q.isError ? (
        <ErrorState message={getApiErrorMessage(q.error, 'Could not load the planner')} onRetry={() => q.refetch()} />
      ) : !d ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-separate border-spacing-1 p-2 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">Person</th>
                {d.weeks.map((w) => <th key={w} className={cn('px-1 py-1.5 text-center text-[11px] font-semibold text-muted-foreground', w <= d.today && addDays(w, 6) >= d.today && 'text-primary')}>{shortDate(w)}</th>)}
                <th className="px-1 py-1.5 text-center text-[11px] font-semibold text-muted-foreground">Free next month</th>
              </tr>
            </thead>
            <tbody>
              {!d.people.length && <tr><td colSpan={d.weeks.length + 2} className="py-8 text-center text-muted-foreground">Nobody matches.</td></tr>}
              {d.people.map((r) => (
                <tr key={r.employee.id}>
                  <td className="sticky left-0 z-10 bg-surface px-2 py-1">
                    <div className="flex items-center gap-2">
                      <PersonAvatar person={r.employee} size="sm" />
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{r.employee.firstName} {r.employee.lastName}</span><span className="block truncate text-[11px] text-muted-foreground">{r.employee.designation?.name ?? r.employee.department?.name ?? '—'}</span></span>
                    </div>
                  </td>
                  {r.cells.map((c) => (
                    <td key={c.week} className="p-0">
                      <button type="button" onClick={() => setCell({ person: r.employee, cell: c })} className={cn('relative flex h-10 w-full min-w-[64px] flex-col items-center justify-center overflow-hidden rounded-lg text-xs font-bold transition-transform hover:scale-[1.04]', tone(c.total))} title={c.projects.map((x) => `${x.name} ${x.allocation}%${x.type === 'CLIENT' && x.billed ? ' · billable' : ' · investment'}`).join('\n') || 'Free'}>
                        {c.total ? `${c.total}%` : '—'}
                        {c.total > 0 && (
                          <span className="absolute inset-x-1.5 bottom-1 flex h-1 overflow-hidden rounded-full bg-black/5">
                            <i className="bg-primary" style={{ width: `${c.billable}%` }} />
                            <i className="bg-teal-500" style={{ width: `${c.investment}%` }} />
                          </span>
                        )}
                      </button>
                    </td>
                  ))}
                  <td className={cn('px-2 text-center text-xs font-bold', r.freeNextMonth === 100 ? 'text-warning' : r.freeNextMonth > 0 ? 'text-success' : 'text-muted-foreground')}>{r.freeNextMonth}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={d.meta.page} totalPages={d.meta.totalPages} total={d.meta.total} limit={d.meta.limit} onPageChange={setPage} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            {[['bg-success-soft', '100%'], ['bg-primary-soft', '50–99%'], ['bg-warning-soft', '1–49%'], ['bg-muted', 'Free']].map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><i className={cn('h-3 w-3 rounded', c)} />{l}</span>)}
            <span className="flex items-center gap-1.5"><i className="h-1 w-4 rounded bg-primary" /> billable</span>
            <span className="flex items-center gap-1.5"><i className="h-1 w-4 rounded bg-teal-500" /> investment</span>
            <span className="ml-auto">The busiest day of each week decides the cell</span>
          </div>
        </Card>
      )}

      {d && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader icon={<Zap />} title={`Requests waiting for the PMO · ${d.suggestions.length}`} description="Who could take them — assign from the request so every step is recorded" action={<Link href="/app/resources" className="text-xs font-medium text-primary hover:underline">Resource requests</Link>} />
            <ul className="space-y-3 px-5 pb-5">
              {!d.suggestions.length && <li className="text-sm text-muted-foreground">Nothing waiting for the PMO. Leads ask for people from their project (Request a person).</li>}
              {d.suggestions.map((s) => (
                <li key={s.role.id} className={cn('rounded-xl border p-3', focusRole === s.role.id ? 'border-primary ring-2 ring-primary/20' : 'border-border')}>
                  <p className="text-sm font-semibold"><Link href={`/app/resources/${s.role.id}`} className="hover:underline">{s.role.title}</Link> · {s.role.allocation}% <span className="font-normal text-muted-foreground">from {shortDate(s.role.fromDate)} · <Link href={`/app/projects/${s.role.project.id}`} className="hover:underline">{s.role.project.name}</Link></span></p>
                  {!s.candidates.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">Nobody has {s.role.allocation}% free for 4 weeks from then.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {s.candidates.map((c) => (
                        <li key={c.employee.id} className="flex items-center gap-2 text-sm">
                          <PersonAvatar person={c.employee} size="xs" />
                          <span className="min-w-0 flex-1 truncate">{c.employee.firstName} {c.employee.lastName}</span>
                          <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">{c.free}% free</span>
                          <Button size="sm" variant="secondary" asChild><Link href={`/app/resources/${s.role.id}`}><UserPlus /> Assign</Link></Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <div className="space-y-4">
            <FindFree onAssign={setAssign} today={d.today} />
            <Card>
              <CardHeader icon={<Users />} title="Rolling off soon" description="Their last project ends within 3 weeks and nothing is booked after" />
              <ul className="space-y-2.5 px-5 pb-5">
                {!d.rollingOff.length && <li className="text-sm text-muted-foreground">Nobody.</li>}
                {d.rollingOff.map((r) => (
                  <li key={r.employee.id} className="flex items-center gap-2.5 text-sm">
                    <PersonAvatar person={r.employee} size="sm" />
                    <span className="min-w-0 flex-1"><span className="block font-medium">{r.employee.firstName} {r.employee.lastName}</span><span className="block text-xs text-muted-foreground">{r.project} ends {shortDate(r.endDate)}</span></span>
                    <Button size="sm" variant="secondary" onClick={() => setAssign({ employee: r.employee, allocation: 100, startDate: addDays(r.endDate, 1) })}>Book next</Button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {cell && (
        <Modal open onClose={() => setCell(null)} icon={<Users />} title={`${cell.person.firstName} ${cell.person.lastName} · week of ${shortDate(cell.cell.week)}`} description={`${cell.cell.total}% booked · ${cell.cell.billable}% billable · ${cell.cell.investment}% investment`} footer={<><Button variant="secondary" onClick={() => setCell(null)}>Close</Button>{cell.cell.total < 100 && <Button onClick={() => { setAssign({ employee: cell.person, allocation: 100 - cell.cell.total, startDate: cell.cell.week }); setCell(null); }}><UserPlus /> Book {100 - cell.cell.total}%</Button>}</>}>
          {cell.cell.projects.length ? (
            <ul className="divide-y divide-border">
              {cell.cell.projects.map((x) => (
                <li key={x.memberId} className="flex items-center gap-3 py-2.5 text-sm">
                  <i className="h-2.5 w-2.5 rounded-sm" style={{ background: projectColor(x) }} />
                  <Link href={`/app/projects/${x.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{x.name}</Link>
                  <span className="text-xs text-muted-foreground">{x.type === 'CLIENT' ? (x.billed ? 'Billable' : 'Not billed') : 'Investment'}</span>
                  <b className="w-10 text-right tabular-nums">{x.allocation}%</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Free this week.</p>
          )}
        </Modal>
      )}
      {assign && <AssignDialog request={assign} onClose={() => setAssign(null)} />}
    </div>
  );
}

export default function PlannerPage() {
  return (
    <Suspense>
      <PlannerContent />
    </Suspense>
  );
}

function FindFree({ onAssign, today }: { onAssign: (r: AssignRequest) => void; today: string }) {
  const [from, setFrom] = useState(today);
  const [weeksFor, setWeeksFor] = useState(6);
  const [min, setMin] = useState(50);
  const [query, setQuery] = useState<{ from: string; to: string; min: number } | null>(null);
  const r = useAvailable(query);
  return (
    <Card>
      <CardHeader icon={<Search />} title="Find someone free" />
      <div className="space-y-3 px-5 pb-5">
        <div className="grid grid-cols-3 gap-2">
          <Field label="From" htmlFor="ff-from"><DateInput id="ff-from" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="For" htmlFor="ff-weeks"><Select id="ff-weeks" className={inputClass} value={weeksFor} onChange={(e) => setWeeksFor(Number(e.target.value))}>{[2, 4, 6, 8, 12].map((w) => <option key={w} value={w}>{w} weeks</option>)}</Select></Field>
          <Field label="At least" htmlFor="ff-min"><Select id="ff-min" className={inputClass} value={min} onChange={(e) => setMin(Number(e.target.value))}>{[25, 50, 75, 100].map((m) => <option key={m} value={m}>{m}% free</option>)}</Select></Field>
        </div>
        <Button size="sm" onClick={() => setQuery({ from, to: addDays(from, weeksFor * 7 - 1), min })}><Search /> Search</Button>
        {r.data && (
          <>
          <ul className="space-y-1.5">
            {!r.data.pages[0]?.rows.length && <li className="text-sm text-muted-foreground">Nobody is that free then.</li>}
            {r.data.pages.flatMap((pg) => pg.rows).map((x) => (
              <li key={x.employee.id} className="flex items-center gap-2 text-sm">
                <PersonAvatar person={x.employee} size="xs" />
                <span className="min-w-0 flex-1 truncate">{x.employee.firstName} {x.employee.lastName} <span className="text-xs text-muted-foreground">· {x.employee.designation?.name ?? x.employee.department?.name ?? ''}</span></span>
                <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">{x.free}% free</span>
                <Button size="sm" variant="secondary" onClick={() => onAssign({ employee: x.employee, allocation: Math.min(x.free, 100), startDate: query!.from })}>Book</Button>
              </li>
            ))}
          </ul>
          <LoadMore shown={r.data.pages.reduce((n, pg) => n + pg.rows.length, 0)} total={r.data.pages[0]?.meta.total ?? 0} loading={r.isFetchingNextPage} onMore={() => void r.fetchNextPage()} />
          </>
        )}
      </div>
    </Card>
  );
}
