'use client';

import { useSwipeAway } from '@/components/motion/use-swipe-away';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, ClipboardCheck, Inbox, List, Search, ShieldCheck, UserX } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Pagination, Skeleton, Tabs } from '@/components/ui/feedback';
import { Input, inputClass } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useAccess } from '@/lib/access/use-access';
import { useIsApprover } from '@/lib/company/projects';
import { TS_STATUS, addDays, fmtHours, mondayOf, todayKey, useApproveTimesheet, useCompliance, useTimesheets, weekLabel, type TimesheetStatus } from '@/lib/company/timesheets';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';

type View = 'review' | 'team' | 'compliance';

export default function TimesheetApprovalsPage() {
  const { can, scopeOf, hasFeature, isLoading: accessLoading } = useAccess();
  const isApprover = useIsApprover('leave.approve');
  const approver = isApprover || can('timesheet.approve');
  const seesTeam = can('timesheet.view') && scopeOf('timesheet.view') !== 'own';
  const [chosen, setView] = useState<View | null>(null);
  const view = chosen ?? (approver ? 'review' : 'team');
  const allowed = hasFeature('work.timesheets') && (approver || seesTeam);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" description="You don’t approve or review timesheets." />;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Timesheets" title="Timesheet approvals" description="Weeks submitted by people on your projects or in your team. Any one of their approvers can decide." />
      <Tabs
        tabs={[
          ...(approver ? [{ id: 'review' as const, label: 'Waiting for me', icon: <Inbox /> }] : []),
          ...(seesTeam ? [{ id: 'team' as const, label: 'Team weeks', icon: <List /> }, { id: 'compliance' as const, label: 'Who’s filled', icon: <UserX /> }] : []),
        ]}
        value={view}
        onChange={setView}
      />
      {view === 'compliance' ? <Compliance /> : <Sheets view={view} />}
    </div>
  );
}

function Sheets({ view }: { view: 'review' | 'team' }) {
  const [status, setStatus] = useState<TimesheetStatus | ''>('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [view, status]);
  const list = useTimesheets({ view, status: view === 'team' ? status || undefined : undefined, page });
  const approve = useApproveTimesheet();
  const swipe = useSwipeAway(list.data?.data, byId);

  return (
    <div className="space-y-3">
      {view === 'team' && (
        <select className={`${inputClass} w-auto`} value={status} onChange={(e) => setStatus(e.target.value as TimesheetStatus | '')} aria-label="Status">
          <option value="">Submitted, approved or sent back</option>
          {(['SUBMITTED', 'APPROVED', 'REJECTED'] as const).map((s) => <option key={s} value={s}>{TS_STATUS[s].label}</option>)}
        </select>
      )}
      {list.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : list.isError ? (
        <ErrorState message={getApiErrorMessage(list.error, 'Could not load timesheets')} onRetry={() => void list.refetch()} />
      ) : !swipe.rows.length ? (
        <EmptyState icon={<ClipboardCheck />} title={view === 'review' ? 'Nothing is waiting for you' : 'No timesheets yet'} />
      ) : (
        <div className="space-y-2 overflow-x-hidden">
          {swipe.rows.map(({ item: s, leaving }) => (
            <Card key={s.id} className={leaving ? 'm-swipe flex flex-wrap items-center gap-3 p-4' : 'flex flex-wrap items-center gap-3 p-4'}>
              <PersonAvatar person={s.employee} />
              <Link href={`/app/timesheets?week=${s.weekStart}&employeeId=${s.employee.id}`} className="min-w-0 flex-1 hover:underline">
                <p className="truncate font-medium">{s.employee.firstName} {s.employee.lastName} · {weekLabel(s.weekStart)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {fmtHours(s.totalMinutes)}
                  {s.submittedAt && ` · submitted ${formatRelative(s.submittedAt)}`}
                  {s.decidedBy && ` · ${s.status === 'APPROVED' ? 'approved' : 'sent back'} by ${s.decidedBy.firstName}`}
                  {s.status === 'SUBMITTED' && s.approverLabel && ` · ${s.approverLabel}`}
                </p>
              </Link>
              <Badge tone={TS_STATUS[s.status].tone}>{TS_STATUS[s.status].label}</Badge>
              {!leaving && s.canDecide && (
                <Button
                  size="sm"
                  loading={approve.isPending && approve.variables?.id === s.id}
                  onClick={() => {
                    swipe.markDone(s);
                    approve.mutate({ id: s.id }, { onSuccess: () => toast.success(`Approved ${s.employee.firstName}’s week`), onError: (e) => { swipe.unmark(s); toast.error(getApiErrorMessage(e, 'Could not approve')); } });
                  }}
                >
                  <Check /> Approve
                </Button>
              )}
            </Card>
          ))}
          {list.data && <Pagination page={page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />}
        </div>
      )}
    </div>
  );
}

function Compliance() {
  const lastWeek = addDays(mondayOf(todayKey()), -7);
  const [week, setWeek] = useState(lastWeek);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const q = useCompliance({ weekStart: week, status: status || undefined, search: debounced || undefined, page });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="secondary" aria-label="Previous week" onClick={() => { setWeek(addDays(week, -7)); setPage(1); }}><ChevronLeft /></Button>
        <span className="min-w-[150px] text-center text-sm font-semibold">{weekLabel(week)}</span>
        <Button size="icon-sm" variant="secondary" aria-label="Next week" disabled={week >= mondayOf(todayKey())} onClick={() => { setWeek(addDays(week, 7)); setPage(1); }}><ChevronRight /></Button>
        <select className={`${inputClass} w-auto`} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
          <option value="">Everyone</option>
          <option value="missing">Not started</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Waiting for approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Sent back</option>
        </select>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or employee ID…" className="pl-9" aria-label="Search people" />
        </div>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : q.isError ? (
        <ErrorState message={getApiErrorMessage(q.error, 'Could not load')} onRetry={() => void q.refetch()} />
      ) : !q.data?.data.length ? (
        <EmptyState icon={<UserX />} title="Nobody here" />
      ) : (
        <>
          <Card className="divide-y divide-border">
            {q.data.data.map(({ employee: e, timesheet: t }) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <PersonAvatar person={e} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.firstName} {e.lastName}</p>
                  <p className="truncate text-xs text-muted-foreground">{[e.designation?.name, e.department?.name].filter(Boolean).join(' · ') || e.employeeId}</p>
                </div>
                {t && <span className="tabular-nums text-muted-foreground">{fmtHours(t.totalMinutes)}</span>}
                {t ? (
                  <Link href={`/app/timesheets?week=${week}&employeeId=${e.id}`}><Badge tone={TS_STATUS[t.status].tone}>{TS_STATUS[t.status].label}</Badge></Link>
                ) : (
                  <Badge tone="danger">Not started</Badge>
                )}
              </div>
            ))}
          </Card>
          <Pagination page={page} totalPages={q.data.meta.totalPages} total={q.data.meta.total} limit={q.data.meta.limit} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

const byId = (t: { id: string }) => t.id;
