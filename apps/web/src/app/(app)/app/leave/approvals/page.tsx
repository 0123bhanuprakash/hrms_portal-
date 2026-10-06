'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, CheckCircle2, FileText, Inbox, List, MessageCircleQuestion, ShieldCheck, Users, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Pagination, Skeleton, Tabs } from '@/components/ui/feedback';
import { Field, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { Confetti } from '@/components/motion/motion';
import { LeaveRequestCard } from '@/components/leave/request-card';
import { useAccess } from '@/lib/access/use-access';
import { useIsApprover } from '@/lib/company/projects';
import { leaveRange, openLeaveDocument, useAskQuestion, useDecideLeave, useLeaveRequests, useWhosOff, type LeaveRequest, type LeaveStatus } from '@/lib/company/leave';
import { useSwipeAway } from '@/components/motion/use-swipe-away';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { ViewingNow } from '@/components/live/viewing-now';

type View = 'review' | 'all';
const addDays = (k: string, n: number) => {
  const d = new Date(`${k}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function LeaveApprovalsPage() {
  const { can, scopeOf, access, hasFeature, isLoading: accessLoading } = useAccess();
  const delegated = access?.delegations.filter((d) => d.permissions.includes('leave.approve')) ?? [];
  const isApprover = useIsApprover('leave.approve');
  const approver = can('leave.approve') || delegated.length > 0 || isApprover;
  const canSeeAll = can('leave.view') && scopeOf('leave.view') !== 'own';
  const allowed = hasFeature('time.leave') && (approver || canSeeAll);
  // Default tab follows access once it has loaded (approvers start on their queue)
  const [chosen, setView] = useState<View | null>(null);
  const view: View = chosen ?? (approver ? 'review' : 'all');
  const [status, setStatus] = useState<LeaveStatus | ''>('');
  const [page, setPage] = useState(1);
  const [deciding, setDeciding] = useState<{ request: LeaveRequest; action: 'approve' | 'reject' } | null>(null);
  const [asking, setAsking] = useState<LeaveRequest | null>(null);
  const [cleared, setCleared] = useState(false);
  const list = useLeaveRequests({ view, status: view === 'all' && status ? status : undefined, page }, allowed);
  const swipe = useSwipeAway(list.data?.data, leaveKey);
  const decide = useDecideLeave();
  const pending = swipe.rows.filter((x) => !x.leaving && x.item.canDecide).map((x) => x.item);
  const clashFree = pending.filter((r) => !(r.team?.overlaps.length));

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" description="You don’t approve or review leave." />;

  const approveClashFree = async () => {
    let ok = 0;
    for (const r of clashFree) {
      try {
        swipe.markDone(r);
        await decide.mutateAsync({ id: r.id, action: 'approve' });
        ok++;
      } catch (err) {
        swipe.unmark(r);
        toast.error(getApiErrorMessage(err, `Could not approve ${r.employee.firstName}’s request`));
      }
    }
    if (ok) toast.success(`Approved ${ok} request${ok === 1 ? '' : 's'} with no team clash`);
    if (ok === pending.length) setCleared(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Time" title="Leave approvals" description="Requests waiting for your decision, and leave across the people you look after." />

      {delegated.length > 0 && (
        <p className="rounded-lg border border-border bg-subtle/60 px-4 py-3 text-sm text-muted-foreground">
          You are covering leave approvals for {delegated.map((d) => d.fromName).join(', ')} — your decisions are recorded on their behalf.
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          className="flex-1"
          tabs={[
            ...(approver ? [{ id: 'review' as const, label: 'Waiting for me', icon: <Inbox />, ...(view === 'review' && list.data && { count: list.data.meta.total }) }] : []),
            ...(canSeeAll ? [{ id: 'all' as const, label: 'All requests', icon: <List /> }] : []),
          ]}
          value={view}
          onChange={(v) => { setView(v); setPage(1); setCleared(false); }}
        />
        {view === 'review' && clashFree.length > 1 && (
          <Button size="sm" className="mb-1" loading={decide.isPending} onClick={() => void approveClashFree()}>
            <Check /> Approve {clashFree.length} without clashes
          </Button>
        )}
      </div>

      {view === 'all' && (
        <div className="flex flex-wrap gap-1.5">
          {(['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((s) => (
            <Button key={s || 'any'} size="sm" variant={status === s ? 'soft' : 'ghost'} onClick={() => { setStatus(s); setPage(1); }}>
              {s ? s.charAt(0) + s.slice(1).toLowerCase() : 'Any status'}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div>
          {list.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}</div>
          ) : list.isError ? (
            <ErrorState message={getApiErrorMessage(list.error, 'Could not load requests')} onRetry={() => list.refetch()} />
          ) : !swipe.rows.length ? (
            <div className="relative overflow-hidden rounded-xl">
              {cleared && <Confetti />}
              <EmptyState icon={<Inbox />} title={view === 'review' ? 'All caught up' : 'No leave requests'} description={view === 'review' ? 'Nothing is waiting for you.' : undefined} />
            </div>
          ) : (
            <div className="space-y-3 overflow-x-hidden">
              {swipe.rows.map(({ item: r, leaving }) => (
                <div key={r.id} className={leaving ? 'm-swipe rounded-xl' : 'm-rise'}>
                  <LeaveRequestCard
                    request={r}
                    showEmployee
                    footer={r.status === 'PENDING' && (r.team || r.document || r.needsDocument) ? <RequestExtras r={r} /> : null}
                    actions={
                      !leaving && r.canDecide && (
                        <div className="flex flex-col items-start gap-1.5 md:items-end">
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setAsking(r)}><MessageCircleQuestion /> Ask</Button>
                            <Button size="sm" variant="secondary" onClick={() => setDeciding({ request: r, action: 'reject' })}><X /> Reject</Button>
                            <Button size="sm" onClick={() => setDeciding({ request: r, action: 'approve' })}><Check /> Approve</Button>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {r.requiredLevels > 1 && `Level ${r.currentLevel} of ${r.requiredLevels}`}
                            {r.decideAs === 'delegate' && ' · covering'}
                            {r.decideAs === 'override' && ' · as HR (final)'}
                          </span>
                        </div>
                      )
                    }
                  />
                </div>
              ))}
              {list.data && <Pagination page={page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <NextWeeks />
          <Card className="p-4 text-xs text-muted-foreground">
            When many people in a team are away at the same time you see a warning — you can still approve. Approving swipes the card away and tells the person (or sends it to the next level).
          </Card>
        </div>
      </div>

      <DecideDialog
        value={deciding}
        onClose={() => setDeciding(null)}
        onDone={swipe.markDone}
        onUndo={swipe.unmark}
        onLast={() => pending.length === 1 && setCleared(true)}
      />
      <AskDialog request={asking} onClose={() => setAsking(null)} />
    </div>
  );
}

/** Mini calendar of the request with teammates who are off, clash warning, document. */
function RequestExtras({ r }: { r: LeaveRequest }) {
  const from = addDays(r.startDate, -1);
  const to = addDays(r.endDate, 1);
  const span: string[] = [];
  for (let k = from; k <= to && span.length < 14; k = addDays(k, 1)) span.push(k);
  const overlaps = r.team?.overlaps ?? [];
  const people = new Set(overlaps.map((o) => o.employee.id)).size;
  const size = r.team?.teamSize ?? 1;
  const heavy = people > 0 && (people + 1) / size >= 0.5;
  return (
    <div className="mt-3 flex flex-wrap items-start gap-4 border-t border-border pt-3">
      <div className="flex gap-1" aria-label="Request days with teammates off">
        {span.map((k) => {
          const mine = k >= r.startDate && k <= r.endDate;
          const wd = new Date(`${k}T00:00:00Z`).getUTCDay();
          const who = overlaps.filter((o) => o.startDate <= k && o.endDate >= k);
          return (
            <span
              key={k}
              title={who.length ? `Also off: ${who.map((o) => o.employee.firstName).join(', ')}` : undefined}
              className={cn('relative flex h-11 w-10 flex-col rounded-lg border px-1.5 py-1 text-[11px] font-bold tabular-nums', mine ? 'border-primary bg-primary text-primary-foreground' : wd === 0 || wd === 6 ? 'border-transparent bg-muted text-muted-foreground' : 'border-border text-muted-foreground')}
            >
              {Number(k.slice(8))}
              {who.length > 0 && (
                <span className="absolute bottom-0.5 right-0.5 flex">
                  {who.slice(0, 2).map((o) => <PersonAvatar key={o.employee.id} person={o.employee} size="xs" className="-ml-1.5 h-4 w-4 border border-surface text-[6px] first:ml-0" />)}
                </span>
              )}
            </span>
          );
        })}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 text-xs">
        {r.team &&
          (people ? (
            <p className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold', heavy ? 'bg-warning-soft text-warning' : 'bg-subtle text-muted-foreground')}>
              {heavy ? <AlertTriangle className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
              {people + 1} of {size} in the team away at some point · {overlaps.slice(0, 3).map((o) => o.employee.firstName).join(', ')}
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 font-semibold text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Team covered — nobody else is off</p>
          ))}
        {r.document && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void openLeaveDocument(r.id)}><FileText /> {r.document.name}</Button>
        )}
        {r.needsDocument && <Badge tone="warning">Document asked for — not attached yet</Badge>}
      </div>
    </div>
  );
}

/** How many people are away each week for the next 4 weeks (your reach). */
function NextWeeks() {
  const today = new Date().toISOString().slice(0, 10);
  const m1 = today.slice(0, 7);
  const m2 = (() => {
    const d = new Date(`${m1}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d.toISOString().slice(0, 7);
  })();
  const a = useWhosOff({ month: m1 });
  const b = useWhosOff({ month: m2 });
  const weeks = useMemo(() => {
    const leaves = [...(a.data?.leaves ?? []), ...(b.data?.leaves ?? [])];
    const monday = (() => {
      const d = new Date(`${today}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    })();
    return Array.from({ length: 4 }, (_, i) => {
      const s = addDays(monday, i * 7);
      const e = addDays(s, 4);
      const who = new Map(leaves.filter((l) => l.startDate <= e && l.endDate >= s).map((l) => [l.employee.id, l.employee]));
      return { s, people: [...who.values()] };
    });
  }, [a.data, b.data, today]);
  const max = Math.max(4, ...weeks.map((w) => w.people.length));
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold">Away in the next 4 weeks</p>
      <ul className="mt-3 space-y-2.5">
        {weeks.map((w) => (
          <li key={w.s} className="grid grid-cols-[64px_1fr_auto] items-center gap-2 text-xs">
            <span className="text-muted-foreground">{new Date(`${w.s}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-muted">
              <span className={cn('m-fill-w block h-full rounded-full', w.people.length >= max * 0.75 ? 'bg-warning' : 'bg-primary')} style={{ width: `${(w.people.length / max) * 100}%` }} />
            </span>
            <span className="flex">{w.people.slice(0, 3).map((p) => <PersonAvatar key={p.id} person={p} size="xs" className="-ml-1.5 border-2 border-surface first:ml-0" />)}{!w.people.length && <span className="text-muted-foreground">nobody</span>}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AskDialog({ request: r, onClose }: { request: LeaveRequest | null; onClose: () => void }) {
  const ask = useAskQuestion();
  const [q, setQ] = useState('');
  if (!r) return null;
  const submit = async () => {
    try {
      await ask.mutateAsync({ id: r.id, question: q });
      toast.success(`Question sent to ${r.employee.firstName} — the request stays pending`);
      setQ('');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send the question'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={ask.isPending}
      icon={<MessageCircleQuestion />}
      title={`Ask ${r.employee.firstName} a question`}
      description={`${r.leaveType.name}, ${leaveRange(r)}. They get it in-app; the request stays pending.`}
      size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={ask.isPending} disabled={q.trim().length < 3}>Send question</Button></>}
    >
      <Field label="Question" htmlFor="lv-q">
        <Textarea id="lv-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} rows={3} placeholder="e.g. Who will cover the release on the 12th?" />
      </Field>
    </Modal>
  );
}

function DecideDialog({ value, onClose, onDone, onUndo, onLast }: { value: { request: LeaveRequest; action: 'approve' | 'reject' } | null; onClose: () => void; onDone: (r: LeaveRequest) => void; onUndo: (r: LeaveRequest) => void; onLast: () => void }) {
  const decide = useDecideLeave();
  const [note, setNote] = useState('');
  if (!value) return null;
  const { request: r, action } = value;
  const submit = async () => {
    try {
      onDone(r);
      const res = await decide.mutateAsync({ id: r.id, action, note });
      toast.success(action === 'reject' ? 'Leave rejected' : res.status === 'APPROVED' ? 'Leave approved' : `Approved — now with level ${res.currentLevel}`);
      setNote('');
      onLast();
      onClose();
    } catch (err) {
      onUndo(r);
      toast.error(getApiErrorMessage(err, 'Could not save the decision'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={decide.isPending}
      icon={action === 'approve' ? <Check /> : <X />}
      title={`${action === 'approve' ? 'Approve' : 'Reject'} ${r.employee.firstName}’s ${r.leaveType.name.toLowerCase()}?`}
      description={`${leaveRange(r)} · ${r.totalDays} day${r.totalDays === 1 ? '' : 's'}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={decide.isPending}>Cancel</Button>
          <Button variant={action === 'approve' ? 'primary' : 'danger'} onClick={submit} loading={decide.isPending}>{action === 'approve' ? 'Approve' : 'Reject'}</Button>
        </>
      }
    >
      <ViewingNow kind="leave" id={r.id} className="mb-3" />
      {action === 'approve' && (r.team?.overlaps.length ?? 0) > 0 && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {new Set(r.team!.overlaps.map((o) => o.employee.id)).size} teammate(s) are also off in these dates. You can still approve.
        </p>
      )}
      <Field label={action === 'approve' ? 'Note (optional)' : 'Reason (optional)'} htmlFor="lv-note">
        <Textarea id="lv-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
      </Field>
    </Modal>
  );
}
const leaveKey = (r: { id: string }) => r.id;
