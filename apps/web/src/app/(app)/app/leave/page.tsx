'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Lightbulb, Plane, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, Pagination, Skeleton, Tabs } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ApplyLeaveDialog, useLeaveDrafts, type LeaveDraft } from '@/components/leave/apply-dialog';
import { useFocusedRequest } from '@/components/leave/request-card';
import { LeaveHistoryRow } from '@/components/leave/leave-history';
import { FlipDigits, Ring, daysBetween } from '@/components/time/visuals';
import { useAccess } from '@/lib/access/use-access';
import { useMyCard } from '@/lib/company/profile';
import { useHolidays, type Holiday } from '@/lib/company/attendance';
import { AskableCards, windowLabel } from '@/components/leave/grants';
import { AskExtraDialog, LedgerDialog, type AskExtraInit } from '@/components/leave/extra-leave';
import { days as dayCount, leaveRange, useAttachDocument, useCancelLeave, useLeaveBalances, useLeaveRequests, useLeaveTypes, type LeaveBalance, type LeaveRequest, type LeaveStatus } from '@/lib/company/leave';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { NoProfile } from '@/components/profile/no-profile';

const todayKey = () => new Date().toISOString().slice(0, 10);
const addDays = (k: string, n: number) => {
  const d = new Date(`${k}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmt = (k: string, o: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(`${k}T00:00:00Z`).toLocaleDateString(undefined, { ...o, timeZone: 'UTC' });

export default function MyLeavePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <MyLeave />
    </Suspense>
  );
}

function MyLeave() {
  const params = useSearchParams();
  const router = useRouter();
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const me = useMyCard();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [apply, setApply] = useState<{ type?: string | null; range?: { start: string; end: string } | null; draft?: LeaveDraft | null } | null>(null);
  const [status, setStatus] = useState<'ALL' | LeaveStatus>('ALL');
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<LeaveRequest | null>(null);
  const allowed = hasFeature('time.leave') && can('leave.view');
  const hasProfile = Boolean(me.data?.employee);
  const list = useLeaveRequests({ view: 'mine', status: status === 'ALL' ? undefined : status, page }, allowed && hasProfile);
  // Same request as “My year” below (one call for both)
  const upcoming = useLeaveRequests({ view: 'mine', limit: 100 }, allowed && hasProfile);
  const focused = useFocusedRequest(list.data?.data.map((r) => r.id));
  const cancel = useCancelLeave();
  const attach = useAttachDocument();

  // /app/leave?apply=WFH opens the form for that type (home quick actions)
  useEffect(() => {
    const code = params.get('apply');
    if (code !== null) {
      setApply({ type: code || null });
      router.replace('/app/leave');
    }
  }, [params, router]);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="Leave isn’t available" description="Leave isn’t enabled for you." />;
  if (me.isSuccess && !hasProfile) return <NoProfile icon={<Plane />} what="Leave needs an employee profile." />;

  const next = (upcoming.data?.data ?? []).filter((r) => (r.status === 'APPROVED' || r.status === 'PENDING') && r.endDate >= todayKey()).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  const upload = async (r: LeaveRequest, file: File) => {
    try {
      await attach.mutateAsync({ id: r.id, file });
      toast.success('Document attached');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not attach the document'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Time"
        title="My leave"
        description="Balances, plans and requests."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" asChild><Link href="/app/attendance/holidays"><CalendarDays /> Holidays</Link></Button>
            {can('leave.request') && <Button onClick={() => setApply({})}><CalendarPlus /> Apply for leave</Button>}
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        {upcoming.isLoading ? <Skeleton className="h-48 w-full rounded-2xl" /> : <NextTrip r={next ?? null} onPlan={() => setApply({})} />}
        <PlanBreak />
      </div>

      <Drafts onOpen={(d) => setApply({ draft: d })} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Balances · {year}</h2>
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="ghost" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}><ChevronLeft /></Button>
            <span className="w-12 text-center text-sm font-medium tabular-nums">{year}</span>
            <Button size="icon-sm" variant="ghost" aria-label="Next year" onClick={() => setYear((y) => y + 1)} disabled={year > new Date().getFullYear()}><ChevronRight /></Button>
          </div>
        </div>
        {hasProfile && <BalanceRings year={year} />}
      </section>

      <MyYear year={year} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold">Leave history{list.data ? <span className="font-normal text-muted-foreground"> · {list.data.meta.total}</span> : null}</h2>
          <Tabs
            tabs={[
              { id: 'ALL' as const, label: 'All' },
              { id: 'PENDING' as const, label: 'Pending' },
              { id: 'APPROVED' as const, label: 'Approved' },
              { id: 'REJECTED' as const, label: 'Rejected' },
              { id: 'CANCELLED' as const, label: 'Cancelled' },
            ]}
            value={status}
            onChange={(s) => { setStatus(s); setPage(1); }}
          />
        </div>
        {list.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : list.isError ? (
          <ErrorState message={getApiErrorMessage(list.error, 'Could not load your requests')} onRetry={() => list.refetch()} />
        ) : !list.data?.data.length ? (
          <EmptyState icon={<Plane />} title="No leave requests" description={status === 'ALL' ? 'When you apply for leave it will show up here.' : undefined} />
        ) : (
          <Card className="overflow-hidden">
            <div className="hidden border-b border-border bg-subtle/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-[minmax(9rem,1fr)_minmax(11rem,1.2fr)_minmax(0,1.1fr)_6.5rem_minmax(8rem,auto)] lg:gap-4">
              <span className="pl-6">Leave</span>
              <span>Dates</span>
              <span>Approval</span>
              <span>Status</span>
              <span />
            </div>
            <ul className="divide-y divide-border">
              {list.data.data.map((r) => (
                <LeaveHistoryRow key={r.id} r={r} focused={r.id === focused} onCancel={setCancelling} onUpload={(req, file) => void upload(req, file)} />
              ))}
            </ul>
            <div className="border-t border-border px-4 py-2">
              <Pagination page={page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />
            </div>
          </Card>
        )}
      </section>

      <ApplyLeaveDialog open={Boolean(apply)} onClose={() => setApply(null)} initialTypeCode={apply?.type} initialRange={apply?.range} draft={apply?.draft} />
      <ConfirmDialog
        isOpen={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        isLoading={cancel.isPending}
        title="Cancel this leave?"
        description={cancelling ? `${cancelling.leaveType.name}, ${leaveRange(cancelling)}. The days go back to your balance.` : ''}
        confirmText="Cancel leave"
        cancelText="Keep it"
        isDanger
        onConfirm={async () => {
          if (!cancelling) return;
          try {
            await cancel.mutateAsync({ id: cancelling.id });
            toast.success('Leave cancelled');
            setCancelling(null);
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not cancel'));
          }
        }}
      />
    </div>
  );
}

/** The next time off with a countdown and its approval steps. */
function NextTrip({ r, onPlan }: { r: LeaveRequest | null; onPlan: () => void }) {
  if (!r) {
    return (
      <section className="relative flex flex-col justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-teal-800 via-cyan-800 to-blue-700 p-6 text-white shadow-card">
        <svg aria-hidden className="tm-fly absolute right-16 top-6" width="64" height="36" viewBox="0 0 70 40"><path d="M2 22 L40 18 L58 4 L64 6 L52 20 L68 22 L64 26 L52 24 L58 36 L52 38 L40 26 L2 24 Z" fill="white" opacity=".85" /></svg>
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">Next time off</p>
        <p className="mt-1 text-2xl font-bold">Nothing planned yet</p>
        <p className="text-sm text-white/80">A break does you good — see the holidays coming up.</p>
        <Button size="sm" className="mt-3 w-max bg-white text-teal-900 hover:bg-white/90" onClick={onPlan}><CalendarPlus /> Plan some time off</Button>
      </section>
    );
  }
  const left = daysBetween(todayKey(), r.startDate);
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-800 via-cyan-800 to-blue-700 p-6 text-white shadow-card">
      <svg aria-hidden className="tm-fly absolute right-40 top-4" width="64" height="36" viewBox="0 0 70 40"><path d="M2 22 L40 18 L58 4 L64 6 L52 20 L68 22 L64 26 L52 24 L58 36 L52 38 L40 26 L2 24 Z" fill="white" opacity=".85" /></svg>
      <div className="flex items-center gap-5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">Next time off</p>
          <p className="text-2xl font-bold">{r.leaveType.name} · {leaveRange(r)}</p>
          <p className="text-sm text-white/80">{dayCount(r.totalDays)}{r.status === 'PENDING' ? ' · waiting for approval' : ' · approved ✓'}</p>
          <ol className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <li className="flex items-center gap-1.5"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/30 font-bold">✓</span>Applied</li>
            {r.approvals.map((a) => (
              <li key={a.level} className="flex items-center gap-1.5">
                <span className="h-px w-4 bg-white/40" />
                <span className={cn('flex h-5 w-5 items-center justify-center rounded-full font-bold', a.status === 'APPROVED' ? 'bg-emerald-400/30' : a.status === 'PENDING' && a.level === r.currentLevel ? 'bg-sky-300/30 ring-2 ring-sky-200' : 'bg-white/15')}>
                  {a.status === 'APPROVED' ? '✓' : a.level}
                </span>
                {(a.actedBy ?? a.approvers?.[0] ?? a.approver)?.firstName ?? 'HR'}
              </li>
            ))}
          </ol>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/15 px-4 py-3">
          {left <= 0 ? <span className="text-2xl font-bold">Now ✈</span> : <FlipDigits value={left} tileClass="bg-white text-teal-800" />}
          <span className="text-[11px] font-semibold text-white/85">{left <= 0 ? 'enjoy!' : `day${left === 1 ? '' : 's'} to go`}</span>
        </div>
      </div>
    </section>
  );
}

/** The next holidays that apply to me; a Monday or Friday holiday is marked as a long weekend. No leave suggestions. */
function PlanBreak() {
  const y = new Date().getFullYear();
  const a = useHolidays(y);
  const b = useHolidays(y + 1);
  const ideas = useMemo(() => {
    const list: Holiday[] = [...(a.data ?? []), ...(b.data ?? [])].filter((h) => h.date > todayKey() && (h.isOptional ? h.chosen : h.appliesToMe !== false));
    return list
      .sort((x, y) => x.date.localeCompare(y.date))
      .slice(0, 3)
      .map((h) => {
        const wd = new Date(`${h.date}T00:00:00Z`).getUTCDay();
        return { h, longWeekend: wd === 1 || wd === 5 };
      });
  }, [a.data, b.data]);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Lightbulb className="h-4 w-4 text-warning" /> Plan a break</h2>
        <span className="text-xs text-muted-foreground">holidays coming up</span>
      </div>
      {!ideas.length ? (
        <p className="mt-3 text-sm text-muted-foreground">No more holidays on the calendar right now.</p>
      ) : (
        <ul className="m-stagger mt-3 space-y-2">
          {ideas.map((x) => (
            <li key={x.h.id} className="flex items-center gap-3 rounded-xl bg-subtle/70 px-3 py-2">
              <span className="text-xl">🗓️</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{x.h.name}</p>
                <p className="truncate text-xs text-muted-foreground">{fmt(x.h.date)}{x.longWeekend && ' · 3-day weekend'}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Drafts({ onOpen }: { onOpen: (d: LeaveDraft) => void }) {
  const [drafts, setDrafts] = useLeaveDrafts();
  const types = useLeaveTypes();
  if (!drafts.length) return null;
  const name = (id: string) => types.data?.find((t) => t.id === id)?.name ?? 'Leave';
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold">Drafts — not sent yet</p>
      <ul className="mt-2 divide-y divide-border">
        {drafts.map((d) => (
          <li key={d.id} className="flex items-center gap-3 py-2 text-sm">
            <span className="flex-1"><b>{name(d.leaveTypeId)}</b> · {d.startDate === d.endDate ? fmt(d.startDate) : `${fmt(d.startDate)} – ${fmt(d.endDate)}`}{d.reason && <span className="text-muted-foreground"> · “{d.reason}”</span>}</span>
            <Button size="sm" variant="secondary" onClick={() => onOpen(d)}>Open</Button>
            <Button size="icon-sm" variant="ghost" aria-label="Delete draft" onClick={() => setDrafts(drafts.filter((x) => x.id !== d.id))}><Trash2 /></Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** One ring per leave type: what is left, with credits coming and days that will lapse. */
function BalanceRings({ year }: { year: number }) {
  const q = useLeaveBalances(undefined, year);
  const [statement, setStatement] = useState<LeaveBalance | null>(null);
  const [asking, setAsking] = useState<AskExtraInit | null>(null);
  if (q.isLoading || (!q.data && !q.isError)) return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>;
  if (q.isError) return <ErrorState message={getApiErrorMessage(q.error, 'Could not load balances')} onRetry={() => q.refetch()} />;
  return (
    <div className="m-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {(q.data?.balances ?? []).map((b) => {
        const total = b.allocated + b.carriedForward + b.adjusted;
        const unlimited = b.available === null;
        const lapse = b.yearEnd?.lapse ?? 0;
        return (
          <Card key={b.leaveType.id} className="flex items-center gap-4 p-4">
            {unlimited ? (
              <Ring value={1} max={1} size={72} stroke={8} barClass="stroke-current" className="opacity-60" label="No limit">
                <span className="text-xl font-bold">∞</span>
              </Ring>
            ) : (
              <span style={{ color: b.leaveType.color }}>
                <Ring value={Math.max(0, b.available!)} max={Math.max(total, 1)} size={72} stroke={8} barClass="stroke-current" label={`${b.available} of ${total} left`}>
                  <span className="text-lg font-bold text-foreground">{b.available}</span>
                  <span className="text-[10px] text-muted-foreground">of {total}</span>
                </Ring>
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{b.leaveType.name}</p>
              <p className="text-xs text-muted-foreground">{unlimited ? `No limit · used ${b.used}` : `${b.used} used${b.pending ? ` · ${b.pending} pending` : ''}`}</p>
              {b.leaveType.accrual === 'MONTHLY' && !unlimited && b.accrued < b.allocated && <p className="text-xs text-muted-foreground">{b.allocated - b.accrued} more to be credited this year</p>}
              {lapse > 0 && year === new Date().getFullYear() && <p className="flex items-center gap-1 text-xs font-semibold text-warning"><AlertTriangle className="h-3 w-3" /> {lapse} will lapse on 31 Dec</p>}
              {(b.lent ?? 0) > 0 && <p className="text-xs font-medium text-info">{dayCount(b.lent!)} lent by HR · used days come from {year + 1}</p>}
              {(b.yearEnd?.owe ?? 0) > 0 && <p className="text-xs font-semibold text-destructive">−{b.yearEnd!.owe} will be taken from {year + 1}</p>}
              {(b.owedLeft ?? 0) > 0 && <p className="text-xs text-warning">{dayCount(b.owedLeft!)} still owed from earlier</p>}
              {b.extraRequest && <p className="text-xs text-muted-foreground">Asked for {dayCount(b.extraRequest.days)} more · waiting</p>}
              <div className="mt-1 flex flex-wrap gap-x-3">
                <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setStatement(b)}>Statement</button>
                {!unlimited && !b.grants && !b.extraRequest && (b.available ?? 0) + (b.below ?? 0) <= 0 && year === new Date().getFullYear() && (
                  <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setAsking({ leaveTypeId: b.leaveType.id, leaveTypeName: b.leaveType.name, year, days: 1 })}>Ask for more</button>
                )}
              </div>
              {b.grants?.map((g) => (
                <p key={g.id} className="text-xs text-muted-foreground">{g.left > 0 ? `Granted · use by ${windowLabel(g.validTo, g.validTo).split(' – ')[0]}` : `Grant ended ${windowLabel(g.validTo, g.validTo).split(' – ')[0]}`}</p>
              ))}
              {(b.carryExpired ?? 0) > 0 && <p className="text-xs text-muted-foreground">{b.carryExpired} carried day{b.carryExpired === 1 ? '' : 's'} expired</p>}
            </div>
          </Card>
        );
      })}
      {year === new Date().getFullYear() && <AskableCards items={q.data?.askable ?? []} />}
      <LedgerDialog balance={statement} year={year} onClose={() => setStatement(null)} />
      <AskExtraDialog init={asking} onClose={() => setAsking(null)} />
    </div>
  );
}

/** The whole year at a glance: my leave and my holidays. */
function MyYear({ year }: { year: number }) {
  const reqs = useLeaveRequests({ view: 'mine', limit: 100 });
  const hol = useHolidays(year);
  const byDay = useMemo(() => {
    const m = new Map<string, { color: string; pending: boolean; name: string }>();
    for (const r of reqs.data?.data ?? []) {
      if (r.status !== 'APPROVED' && r.status !== 'PENDING') continue;
      for (let k = r.startDate; k <= r.endDate; k = addDays(k, 1)) if (k.startsWith(String(year))) m.set(k, { color: r.leaveType.color, pending: r.status === 'PENDING', name: r.leaveType.name });
    }
    return m;
  }, [reqs.data, year]);
  const holidays = new Map((hol.data ?? []).filter((h) => (h.isOptional ? h.chosen : h.appliesToMe !== false)).map((h) => [h.date, h.name]));
  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const today = todayKey();
  return (
    <Card className="h-max p-5">
      <h2 className="text-sm font-semibold">My year</h2>
      <div className="mt-3 grid grid-cols-6 gap-3 md:grid-cols-12">
        {months.map((m, mi) => {
          const len = new Date(Date.UTC(year, mi + 1, 0)).getUTCDate();
          return (
            <div key={mi}>
              <p className="text-center text-[10.5px] font-semibold text-muted-foreground">{m}</p>
              <div className="mt-1 grid grid-cols-5 gap-[2px]">
                {Array.from({ length: len }, (_, d) => {
                  const k = `${year}-${String(mi + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
                  const lv = byDay.get(k);
                  const h = holidays.get(k);
                  return (
                    <span
                      key={k}
                      title={lv ? `${lv.name}${lv.pending ? ' (pending)' : ''}` : h}
                      className={cn('aspect-square rounded-[2px]', !lv && (h ? 'bg-teal-400/70' : 'bg-muted'), k === today && 'ring-1 ring-primary')}
                      style={lv ? { background: lv.pending ? 'transparent' : lv.color, boxShadow: lv.pending ? `inset 0 0 0 1.5px ${lv.color}` : undefined } : undefined}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Coloured = leave (outlined = waiting for approval) · teal = holiday.</p>
    </Card>
  );
}
