'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, ClipboardList, ShieldCheck, UserRound, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { WeekGrid } from '@/components/timesheets/week-grid';
import { useAccess } from '@/lib/access/use-access';
import { useMyCard } from '@/lib/company/profile';
import {
  TS_STATUS,
  addDays,
  fmtHours,
  mondayOf,
  todayKey,
  useApproveTimesheet,
  useRejectTimesheet,
  useTimesheets,
  useWeek,
  weekLabel,
  type Week,
} from '@/lib/company/timesheets';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

export default function TimesheetPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Timesheet />
    </Suspense>
  );
}

function Timesheet() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const me = useMyCard();
  const thisWeek = mondayOf(todayKey());
  const raw = params.get('week');
  const weekStart = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? mondayOf(raw) : thisWeek;
  const employeeId = params.get('employeeId') ?? undefined;
  const allowed = hasFeature('work.timesheets');
  const q = useWeek(weekStart, employeeId, allowed && (Boolean(employeeId) || Boolean(me.data?.employee)));
  const recent = useTimesheets({ view: 'mine', limit: 8 }, allowed && !employeeId && can('timesheet.submit'));

  const go = (w: string) => {
    const sp = new URLSearchParams(params.toString());
    if (w === thisWeek) sp.delete('week');
    else sp.set('week', w);
    router.replace(`${pathname}${sp.toString() ? `?${sp}` : ''}`);
  };

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="Timesheets aren’t available" />;
  if (!employeeId && me.isSuccess && !me.data?.employee) return <EmptyState icon={<UserRound />} title="No employee profile" description="Timesheets are filled by employees." />;

  const w = q.data;
  const other = Boolean(employeeId) && w && !w.isOwn;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={other ? <Link href="/app/timesheets/approvals" className="hover:underline">Timesheet approvals</Link> : 'Timesheets'}
        title={other ? `${w.employee.firstName} ${w.employee.lastName}’s timesheet` : 'My timesheet'}
        description={other ? undefined : 'Log your hours per project and task, then submit the week. Your team lead, project manager or line manager approves it.'}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="secondary" aria-label="Previous week" onClick={() => go(addDays(weekStart, -7))}><ChevronLeft /></Button>
        <span className="min-w-[150px] text-center text-sm font-semibold">{weekLabel(weekStart)}</span>
        <Button size="icon-sm" variant="secondary" aria-label="Next week" disabled={weekStart >= thisWeek} onClick={() => go(addDays(weekStart, 7))}><ChevronRight /></Button>
        {weekStart !== thisWeek && <Button size="sm" variant="ghost" onClick={() => go(thisWeek)}>This week</Button>}
        {w?.status && <Badge tone={TS_STATUS[w.status].tone} className="ml-1">{TS_STATUS[w.status].label}</Badge>}
        {w?.locked && w.isOwn && !w.status && <Badge>Locked</Badge>}
      </div>

      {q.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : q.isError ? (
        <ErrorState message={getApiErrorMessage(q.error, 'Could not load the week')} onRetry={() => void q.refetch()} />
      ) : (
        w && (
          <>
            <Banner w={w} />
            {other && <PersonCard w={w} />}
            {w.lines.length || w.canEdit ? <WeekGrid week={w} /> : <EmptyState icon={<ClipboardList />} title="No hours logged this week" description={w.locked ? 'Weeks older than 8 weeks are locked.' : undefined} />}
            {w.isOwn && w.canEdit && !w.projects.length && <p className="text-xs text-muted-foreground">You aren’t assigned to a project this week — log internal work, or ask the PMO to add you to a project.</p>}
          </>
        )
      )}

      {!employeeId && recent.data && recent.data.data.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Recent weeks</h2>
          <Card className="divide-y divide-border">
            {recent.data.data.map((s) => (
              <button key={s.id} type="button" onClick={() => go(s.weekStart)} className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-subtle', s.weekStart === weekStart && 'bg-subtle')}>
                <span className="flex-1 font-medium">{weekLabel(s.weekStart)}</span>
                <span className="tabular-nums text-muted-foreground">{fmtHours(s.totalMinutes)}</span>
                <Badge tone={TS_STATUS[s.status].tone}>{TS_STATUS[s.status].label}</Badge>
              </button>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function Banner({ w }: { w: Week }) {
  const a = w.approval;
  if (!a || !w.status) return null;
  const who = (n: { firstName: string; lastName: string }) => `${n.firstName} ${n.lastName}`;
  if (w.status === 'REJECTED') {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm">
        <p className="font-medium">Sent back by {a.decidedBy ? who(a.decidedBy) : 'your approver'}{a.decidedAt && ` ${formatRelative(a.decidedAt)}`}</p>
        {a.note && <p className="mt-0.5">“{a.note}”</p>}
        {w.isOwn && <p className="mt-1 text-xs text-muted-foreground">Fix the hours and submit again.</p>}
      </div>
    );
  }
  if (w.status === 'APPROVED') {
    return (
      <div className="rounded-md border border-success/30 bg-success-soft px-4 py-3 text-sm">
        Approved by {a.decidedBy ? who(a.decidedBy) : '—'}{a.onBehalfOf && ` for ${who(a.onBehalfOf)}`}{a.decidedAt && ` ${formatRelative(a.decidedAt)}`}{a.note && ` — “${a.note}”`}
      </div>
    );
  }
  return (
    <div className="rounded-md border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
      Submitted{a.submittedAt && ` ${formatRelative(a.submittedAt)}`} · waiting for {a.approvers.length ? a.approvers.map(who).join(', ') : 'HR'}
      {a.label && <span className="text-muted-foreground"> ({a.label})</span>}
    </div>
  );
}

function PersonCard({ w }: { w: Week }) {
  const approve = useApproveTimesheet();
  const reject = useRejectTimesheet();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <PersonAvatar person={w.employee} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{w.employee.firstName} {w.employee.lastName}</p>
        <p className="text-xs text-muted-foreground">{w.employee.designation?.name ?? w.employee.employeeId} · {fmtHours(w.totalMinutes)} logged</p>
      </div>
      {w.canDecide && w.id && (
        <div className="flex flex-wrap items-center gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-8 w-48" maxLength={500} aria-label="Approval note" />
          <Button size="sm" variant="secondary" onClick={() => setRejecting(true)}><X /> Send back</Button>
          <Button
            size="sm"
            loading={approve.isPending}
            onClick={() => approve.mutate({ id: w.id!, note }, { onSuccess: () => toast.success('Approved'), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not approve')) })}
          >
            <Check /> Approve
          </Button>
        </div>
      )}
      {rejecting && w.id && (
        <Modal
          open
          onClose={() => setRejecting(false)}
          busy={reject.isPending}
          title="Send the week back"
          description={`${w.employee.firstName} can fix it and submit again.`}
          className="sm:max-w-md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setRejecting(false)}>Cancel</Button>
              <Button type="submit" form="ts-reject" variant="danger" loading={reject.isPending}>Send back</Button>
            </>
          }
        >
          <form
            id="ts-reject"
            onSubmit={(e) => {
              e.preventDefault();
              reject.mutate({ id: w.id!, reason }, { onSuccess: () => (toast.success('Sent back'), setRejecting(false)), onError: (er) => toast.error(getApiErrorMessage(er, 'Could not send back')) });
            }}
          >
            <Field label="What needs fixing?" htmlFor="ts-reason" required>
              <Textarea id="ts-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={500} />
            </Field>
          </form>
        </Modal>
      )}
    </Card>
  );
}
