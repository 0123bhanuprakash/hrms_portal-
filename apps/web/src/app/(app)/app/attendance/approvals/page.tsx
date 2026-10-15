'use client';

import { useSwipeAway } from '@/components/motion/use-swipe-away';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, ClipboardCheck, Inbox, Keyboard, ShieldCheck, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge, Kbd } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Pagination, Skeleton, Tabs } from '@/components/ui/feedback';
import { Field, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { Confetti } from '@/components/motion/motion';
import { DayLine, StatusSquares, minuteOf } from '@/components/time/visuals';
import { useAccess } from '@/lib/access/use-access';
import { useIsApprover } from '@/lib/company/projects';
import { CORRECTION_TONE, STATUS_META, clock, dayLabel, useCorrections, usePolicy, useReviewCorrection, type Correction, type CorrectionStatus } from '@/lib/company/attendance';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

export default function AttendanceApprovalsPage() {
  const { can, access, hasFeature, isLoading: accessLoading } = useAccess();
  const delegated = access?.delegations.filter((d) => d.permissions.includes('attendance.approve')) ?? [];
  const isApprover = useIsApprover('attendance.approve');
  const allowed = hasFeature('time.attendance') && (can('attendance.approve') || delegated.length > 0 || isApprover);
  const [status, setStatus] = useState<CorrectionStatus>('PENDING');
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<Correction | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState(0);
  const [cleared, setCleared] = useState(false);
  const list = useCorrections({ view: 'review', status, page }, allowed);
  const policy = usePolicy(allowed);
  const review = useReviewCorrection();
  const swipe = useSwipeAway(list.data?.data, byId);
  const tz = list.data?.meta.timeZone ?? 'Asia/Kolkata';
  const pending = useMemo(() => swipe.rows.filter((r) => !r.leaving && r.item.status === 'PENDING').map((r) => r.item), [swipe.rows]);
  const oldest = useMemo(() => [...pending].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0], [pending]);

  const approve = async (c: Correction, quiet = false) => {
    try {
      swipe.markDone(c);
      await review.mutateAsync({ id: c.id, action: 'approve' });
      if (!quiet) toast.success(`Approved ${c.employee.firstName}’s correction for ${dayLabel(c.date)}`);
      return true;
    } catch (err) {
      swipe.unmark(c);
      toast.error(getApiErrorMessage(err, 'Could not approve'));
      return false;
    }
  };
  const approveSelected = async () => {
    const chosen = pending.filter((c) => selected.has(c.id));
    let ok = 0;
    for (const c of chosen) if (await approve(c, true)) ok++;
    setSelected(new Set());
    if (ok) toast.success(`Approved ${ok} correction${ok === 1 ? '' : 's'}`);
    if (ok === pending.length) setCleared(true);
  };

  // J / K to move, A to approve, R to reject (not while typing)
  useEffect(() => {
    if (status !== 'PENDING') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [role="dialog"]') || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'j') setFocus((f) => Math.min(f + 1, Math.max(0, pending.length - 1)));
      else if (key === 'k') setFocus((f) => Math.max(0, f - 1));
      else if (key === 'a' && pending[focus]) void approve(pending[focus]!).then((ok) => ok && pending.length === 1 && setCleared(true));
      else if (key === 'r' && pending[focus]) setRejecting(pending[focus]!);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!accessLoading && !allowed) {
    return <EmptyState icon={<ShieldCheck />} title="No approvals" description="You don’t approve attendance corrections." />;
  }

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Time" title="Attendance approvals" description="Correction requests from people you approve for. Approved times replace what is on record." />

      {delegated.length > 0 && (
        <p className="rounded-lg border border-border bg-subtle/60 px-4 py-3 text-sm text-muted-foreground">
          You are also covering approvals for {delegated.map((d) => d.fromName).join(', ')}. Decisions you make for their team are recorded as on their behalf.
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          className="flex-1"
          tabs={[
            { id: 'PENDING' as const, label: 'Pending', icon: <Inbox />, ...(status === 'PENDING' && list.data && { count: list.data.meta.total }) },
            { id: 'APPROVED' as const, label: 'Approved', icon: <Check /> },
            { id: 'REJECTED' as const, label: 'Rejected', icon: <X /> },
          ]}
          value={status}
          onChange={(s) => { setStatus(s); setPage(1); setSelected(new Set()); setCleared(false); }}
        />
        {status === 'PENDING' && pending.length > 1 && (
          <div className="flex items-center gap-2 pb-1">
            <Button size="sm" variant="ghost" onClick={() => setSelected(selected.size === pending.length ? new Set() : new Set(pending.map((p) => p.id)))}>
              {selected.size === pending.length ? 'Clear selection' : 'Select all'}
            </Button>
            <Button size="sm" disabled={!selected.size || review.isPending} loading={review.isPending && selected.size > 0} onClick={() => void approveSelected()}>
              <Check /> Approve {selected.size || ''} selected
            </Button>
          </div>
        )}
      </div>

      {list.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : list.isLoadingError ? (
        <ErrorState message={getApiErrorMessage(list.error, 'Could not load requests')} onRetry={() => list.refetch()} />
      ) : !swipe.rows.length ? (
        <div className="relative overflow-hidden">
          {cleared && <Confetti />}
          <EmptyState icon={<ClipboardCheck />} title={status === 'PENDING' ? 'All caught up' : 'Nothing here yet'} description={status === 'PENDING' ? 'No corrections are waiting for you.' : undefined} />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <div className="space-y-3 overflow-x-hidden">
            {swipe.rows.map(({ item: c, leaving }) => {
              const i = pending.indexOf(c);
              return (
                <Card key={c.id} className={cn(leaving ? 'm-swipe p-4' : 'm-rise p-4', i === focus && status === 'PENDING' && 'ring-2 ring-primary/40')}>
                  <div className="flex items-start gap-3">
                    {c.status === 'PENDING' && !leaving && (
                      <input type="checkbox" className="mt-2.5 h-4 w-4 accent-[hsl(var(--primary))]" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.employee.firstName}’s request`} />
                    )}
                    <PersonAvatar person={c.employee} />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {c.employee.firstName} {c.employee.lastName} <span className="font-normal text-muted-foreground">· {dayLabel(c.date, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                        </p>
                        {c.monthCount !== undefined && (
                          <Badge tone={c.overLimit ? 'warning' : 'neutral'} title={c.overLimit ? `More than ${policy.data?.correctionAlertAt ?? 8} this month` : undefined}>
                            {c.overLimit && <AlertTriangle className="h-3 w-3" />}
                            {c.monthCount} this month
                          </Badge>
                        )}
                      </div>
                      <BeforeAfter c={c} tz={tz} />
                      <p className="text-sm">“{c.reason}”</p>
                      <p className="text-xs text-muted-foreground">
                        Asked {formatRelative(c.createdAt)}
                        {c.reviewedBy && ` · ${c.status.toLowerCase()} by ${c.reviewedBy.firstName} ${c.reviewedBy.lastName}`}
                        {c.onBehalfOf && ` on behalf of ${c.onBehalfOf.firstName} ${c.onBehalfOf.lastName}`}
                        {c.reviewNote && ` — “${c.reviewNote}”`}
                      </p>
                    </div>
                    {leaving ? null : c.status === 'PENDING' ? (
                      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                        <Button size="sm" variant="secondary" onClick={() => setRejecting(c)} disabled={review.isPending}><X /> Reject</Button>
                        <Button size="sm" onClick={() => void approve(c).then((ok) => ok && pending.length === 1 && setCleared(true))} loading={review.isPending && review.variables?.id === c.id && review.variables.action === 'approve'}><Check /> Approve</Button>
                      </div>
                    ) : (
                      <Badge tone={CORRECTION_TONE[c.status]}>{c.status.charAt(0) + c.status.slice(1).toLowerCase()}</Badge>
                    )}
                  </div>
                </Card>
              );
            })}
            {list.data && <Pagination page={page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />}
            {status === 'PENDING' && (
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Keyboard className="h-3.5 w-3.5" /> Keyboard: <Kbd>J</Kbd><Kbd>K</Kbd> move · <Kbd>A</Kbd> approve · <Kbd>R</Kbd> reject
              </p>
            )}
          </div>

          <div className="space-y-4">
            {pending[focus]?.recent && (
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <PersonAvatar person={pending[focus]!.employee} size="sm" />
                  <p className="text-sm font-semibold">{pending[focus]!.employee.firstName} · last 30 days</p>
                </div>
                <StatusSquares className="mt-3" days={pending[focus]!.recent!} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {summarise(pending[focus]!)} — helps you judge the request.
                </p>
              </Card>
            )}
            {oldest && (
              <Card className="p-4">
                <p className="text-sm font-semibold">Waiting the longest</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <Badge tone="warning" className="mr-1">{formatRelative(oldest.createdAt)}</Badge>
                  {oldest.employee.firstName}’s request for {dayLabel(oldest.date)}
                </p>
              </Card>
            )}
            <Card className="p-4 text-xs text-muted-foreground">
              There is no limit on corrections. When someone asks for more than <b className="text-foreground">{policy.data?.correctionAlertAt ?? 8}</b> in a month, you and their line manager get a note, and the card shows a warning.
            </Card>
          </div>
        </div>
      )}

      <RejectDialog correction={rejecting} onClose={() => setRejecting(null)} onDone={swipe.markDone} />
    </div>
  );
}

/** "On record" vs "Asked for" on the same time line. */
function BeforeAfter({ c, tz }: { c: Correction; tz: string }) {
  const span = (a: string | null | undefined, b: string | null | undefined) => {
    if (!a) return null;
    const from = minuteOf(a, tz);
    let to = b ? minuteOf(b, tz) : from + 10;
    if (to < from) to += 1440;
    return { from, to };
  };
  const before = span(c.current?.checkIn, c.current?.checkOut);
  const after = span(c.checkIn, c.checkOut);
  return (
    <div className="grid grid-cols-[80px_1fr] items-center gap-x-3 gap-y-1.5 text-xs">
      <span />
      <span />
      <span className="text-muted-foreground">On record</span>
      <div className="flex items-center gap-2">
        <DayLine className="flex-1" ruler={false} height="h-3" blocks={before ? [{ ...before, className: 'bg-muted-foreground/50' }] : []} />
        <span className="w-28 shrink-0 tabular-nums text-muted-foreground">{c.current?.checkIn ? `${clock(c.current.checkIn, tz)}–${clock(c.current.checkOut, tz)}` : c.current ? STATUS_META[c.current.status].label : 'No record'}</span>
      </div>
      <span className="font-semibold text-primary">Asked for</span>
      <div className="flex items-center gap-2">
        <DayLine className="flex-1" ruler={false} height="h-3" blocks={after ? [{ ...after, className: 'bg-primary' }] : []} />
        <span className="w-28 shrink-0 font-medium tabular-nums">{clock(c.checkIn, tz)}–{clock(c.checkOut, tz)}</span>
      </div>
    </div>
  );
}

function summarise(c: Correction) {
  const r = c.recent ?? [];
  const late = r.filter((d) => d.late).length;
  const missing = r.filter((d) => d.status === 'MISSING_CHECKOUT').length;
  const absent = r.filter((d) => d.status === 'ABSENT').length;
  const wfh = r.filter((d) => d.status === 'WFH_NOT_CHECKED_IN').length;
  return [`Late ${late}×`, `${missing} missing check-out${missing === 1 ? '' : 's'}`, `${absent} absent`, ...(wfh ? [`${wfh} WFH not checked in`] : []), `${c.monthCount ?? 0} correction${c.monthCount === 1 ? '' : 's'} this month`].join(' · ');
}

function RejectDialog({ correction, onClose, onDone }: { correction: Correction | null; onClose: () => void; onDone: (c: Correction) => void }) {
  const review = useReviewCorrection();
  const [note, setNote] = useState('');
  if (!correction) return null;
  const submit = async () => {
    try {
      onDone(correction);
      await review.mutateAsync({ id: correction.id, action: 'reject', note });
      toast.success('Request rejected');
      setNote('');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not reject'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={review.isPending}
      icon={<X />}
      title={`Reject ${correction.employee.firstName}’s correction?`}
      description="They will see your note."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={review.isPending}>Cancel</Button>
          <Button variant="danger" onClick={submit} loading={review.isPending}>Reject</Button>
        </>
      }
    >
      <Field label="Note (optional)" htmlFor="rej-note">
        <Textarea id="rej-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="e.g. The office log shows you arrived at 11:00" />
      </Field>
    </Modal>
  );
}

const byId = (c: { id: string }) => c.id;
