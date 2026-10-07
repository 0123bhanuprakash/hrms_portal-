'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight, BellRing, CalendarDays, Check, Lock, Pause, Play, RotateCcw, Search, Undo2, UserCheck, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { DateInput, Select } from '@/components/ui/pickers';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import {
  EVENT_TEXT,
  refOf,
  useCandidates,
  useConsent,
  useDecideRelease,
  useFill,
  useForward,
  useHold,
  useNudge,
  useReject,
  useResourceRequest,
  useUnhold,
  useWithdraw,
  type Candidate,
  type RequestDetail,
} from '@/lib/company/resources';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { LoadBar, StatusPill, StepPath, Who } from './parts';
import { ReasonDialog, RequestPersonDialog } from './dialogs';

const NEXT: Record<string, string> = { PM: 'Delivery Director', DD: 'PMO' };

/** One request or release: where it is, its details, what I can do, and its history. */
export function RequestView({ id, onDone, compact }: { id: string; onDone?: () => void; compact?: boolean }) {
  const q = useResourceRequest(id);
  if (q.isLoading) return <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>;
  if (q.isLoadingError && !(isAxiosError(q.error) && [403, 404].includes(q.error.response?.status ?? 0))) {
    return <ErrorState message={getApiErrorMessage(q.error, 'Could not load the request')} onRetry={() => void q.refetch()} />;
  }
  if (!q.data) return <p className="py-8 text-center text-sm text-muted-foreground">{getApiErrorMessage(q.error, 'This request isn’t available.')}</p>;
  return <RequestBody r={q.data} onDone={onDone} compact={compact} />;
}

function RequestBody({ r, onDone, compact }: { r: RequestDetail; onDone?: () => void; compact?: boolean }) {
  const isRelease = r.kind === 'RELEASE';
  const [again, setAgain] = useState(false);
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-muted-foreground">{refOf(r)}</span>
          <Link href={`/app/projects/${r.project.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 font-semibold hover:bg-subtle">
            <i className="h-2 w-2 rounded-full" style={{ background: r.project.color ?? 'hsl(var(--primary))' }} />
            {r.project.name}
          </Link>
          <StatusPill r={r} />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{isRelease ? `Release · ${r.releaseEmployee?.firstName} ${r.releaseEmployee?.lastName}` : r.title}</h2>
        <StepPath r={r} />
      </div>

      <StateBanner r={r} />

      {/* Details */}
      <dl className="grid gap-x-4 gap-y-2.5 rounded-xl border border-border p-4 text-sm sm:grid-cols-[120px_1fr]">
        <dt className="text-muted-foreground">Raised by</dt>
        <dd>{r.raisedBy ? <Who face={r.raisedBy} note={formatRelative(r.createdAt)} /> : 'Moved over from open roles'}</dd>
        {isRelease ? (
          <>
            <dt className="text-muted-foreground">Person</dt>
            <dd><Who face={r.releaseEmployee} /></dd>
            <dt className="text-muted-foreground">Last day</dt>
            <dd className="font-medium">{r.lastDate && formatDate(r.lastDate)}</dd>
            {r.handover && (<><dt className="text-muted-foreground">Hand-over</dt><dd className="whitespace-pre-line">{r.handover}</dd></>)}
          </>
        ) : (
          <>
            <dt className="text-muted-foreground">Allocation</dt>
            <dd className="font-medium">{r.allocation}% · {r.fromDate && formatDate(r.fromDate)} → {r.untilDate ? formatDate(r.untilDate) : 'project end'}</dd>
            {r.skills.length > 0 && (<><dt className="text-muted-foreground">Skills</dt><dd className="flex flex-wrap gap-1">{r.skills.map((s) => <Badge key={s} tone="neutral">{s}</Badge>)}</dd></>)}
          </>
        )}
        <dt className="text-muted-foreground">Why</dt>
        <dd className="whitespace-pre-line">“{r.reason}”</dd>
      </dl>

      {r.can.consent && <ConsentBox r={r} />}
      {!isRelease && (r.can.fill || r.can.forward || r.can.reject || r.can.hold) && <Decide r={r} onDone={onDone} />}
      {isRelease && (r.can.decideRelease || r.can.hold) && <DecideRelease r={r} onDone={onDone} />}
      {r.can.unhold && <UnholdBox r={r} />}
      <SideActions r={r} onAgain={() => setAgain(true)} />

      {/* History */}
      {!compact && <Timeline r={r} />}
      {compact && (
        <details className="rounded-xl border border-border">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold">History · {r.events.length} step{r.events.length === 1 ? '' : 's'}</summary>
          <div className="px-4 pb-4"><Timeline r={r} bare /></div>
        </details>
      )}
      {again && (
        <RequestPersonDialog
          project={{ id: r.project.id, name: r.project.name, pm: r.pm, dd: r.dd }}
          prefill={{ title: r.title ?? '', skills: r.skills, allocation: r.allocation ?? 100, fromDate: r.fromDate ?? undefined, untilDate: r.untilDate, reason: r.reason, preferredEmployeeId: r.preferred?.id ?? null, previousRequestId: r.id }}
          onClose={() => setAgain(false)}
        />
      )}
    </div>
  );
}

/** What's going on right now, in one line (hold, waiting for the other PM, the outcome). */
function StateBanner({ r }: { r: RequestDetail }) {
  if (r.status === 'ON_HOLD' && r.hold) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm">
        <Pause className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span><b>On hold</b>{r.hold.by && ` by ${r.hold.by.firstName}`} {formatRelative(r.hold.at)} — “{r.hold.reason}”{r.hold.remindAt && <span className="text-muted-foreground"> · reminder {formatDate(r.hold.remindAt)}</span>}</span>
      </p>
    );
  }
  if (r.status === 'AWAITING_CONSENT' && r.pendingFill) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span>Waiting for <b>{r.pendingFill.waitingFor?.firstName}</b> to free up {r.pendingFill.employee?.firstName}’s time on {r.pendingFill.project} (cut to {r.pendingFill.takeFrom?.allocation}%).</span>
      </p>
    );
  }
  const done: Record<string, React.ReactNode> = {
    FILLED: <>Filled with <b>{r.filled?.employee?.firstName} {r.filled?.employee?.lastName}</b> at {r.filled?.allocation}%{r.decidedBy && ` by ${r.decidedBy.firstName}`}{r.outcomeNote && ` — “${r.outcomeNote}”`}</>,
    REJECTED: <>Rejected{r.decidedBy && ` by ${r.decidedBy.firstName}`} — “{r.outcomeNote}”</>,
    WITHDRAWN: <>Withdrawn by the Lead</>,
    RELEASED: <>Sent to the PMO pool after {r.lastDate && formatDate(r.lastDate)}{r.decidedBy && ` by ${r.decidedBy.firstName}`}</>,
    REASSIGNED: <>Moved to <b>{r.target?.name}</b> after {r.lastDate && formatDate(r.lastDate)}{r.decidedBy && ` by ${r.decidedBy.firstName}`}</>,
    KEPT: <>Kept on the project{r.decidedBy && ` by ${r.decidedBy.firstName}`} — “{r.outcomeNote}”</>,
  };
  if (done[r.status]) {
    const bad = r.status === 'REJECTED';
    return (
      <p className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-sm', bad ? 'border-destructive/30 bg-destructive/5' : 'border-success/30 bg-success-soft')}>
        {bad ? <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> : <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
        <span>{done[r.status]}</span>
      </p>
    );
  }
  if (r.canAct && r.kind === 'REQUEST') {
    return (
      <p className="rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
        You’re the {r.step === 'PM' ? 'project manager' : r.step === 'DD' ? 'Delivery Director' : 'PMO'} here. {r.step === 'PMO' ? 'Assign anyone who’s free.' : `You can fill it with people on your projects, or approve it on to the ${NEXT[r.step]}.`}
      </p>
    );
  }
  return null;
}

// ─── Request decision (fill / approve on / hold / reject) ────

function Decide({ r, onDone }: { r: RequestDetail; onDone?: () => void }) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  const cands = useCandidates(r.can.fill ? r.id : null, debounced);
  const [pick, setPick] = useState<string | null>(null);
  const [allocation, setAllocation] = useState(r.allocation ?? 100);
  const [note, setNote] = useState('');
  const [takeFrom, setTakeFrom] = useState<string>('');
  const [dialog, setDialog] = useState<'hold' | 'reject' | null>(null);
  const fill = useFill();
  const forward = useForward();
  const hold = useHold();
  const reject = useReject();
  const list = useMemo(() => cands.data?.data ?? [], [cands.data]);
  const chosen = list.find((c) => c.employee.id === pick) ?? null;
  // Preferred person pre-selected when they can be assigned here
  useEffect(() => {
    if (pick || !list.length) return;
    const pref = list.find((c) => c.preferred && c.underMe);
    if (pref) setPick(pref.employee.id);
  }, [list, pick]);
  const short = chosen ? Math.max(0, allocation - chosen.free) : 0;
  const source = chosen?.projects.find((p) => p.memberId === takeFrom) ?? null;
  const lower = allocation < (r.allocation ?? 0);
  const busy = fill.isPending || forward.isPending;

  const doFill = async () => {
    if (!chosen) return;
    try {
      const res = await fill.mutateAsync({
        id: r.id,
        employeeId: chosen.employee.id,
        allocation,
        note: note.trim() || null,
        takeFrom: short > 0 && source ? { memberId: source.memberId, allocation: Math.max(0, source.allocation - short) } : null,
      });
      toast.success(res.status === 'AWAITING_CONSENT' ? `Asked ${res.pendingFill?.waitingFor?.firstName ?? 'their PM'} to free up ${chosen.employee.firstName}’s time` : `${chosen.employee.firstName} joins ${r.project.name}`);
      onDone?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not fill it'));
    }
  };
  const doForward = async () => {
    try {
      await forward.mutateAsync({ id: r.id, note: note.trim() || null });
      toast.success(`Approved — sent to the ${NEXT[r.step]}`);
      onDone?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not approve it'));
    }
  };

  return (
    <div className="space-y-3">
      {r.can.fill && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{r.preferred ? 'Preferred person, then others who fit' : 'Best matches'}</h3>
            <label className="flex h-8 w-48 items-center gap-1.5 rounded-lg border border-border bg-surface px-2 focus-within:border-ring">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or skill" aria-label="Search people" className="w-full bg-transparent text-xs outline-none" />
            </label>
          </div>
          {cands.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ul className="max-h-[340px] space-y-1.5 overflow-y-auto overscroll-contain pr-1" role="radiogroup" aria-label="Who fills it">
              {list.map((c) => <CandidateRow key={c.employee.id} c={c} want={r.allocation ?? 0} picked={pick === c.employee.id} onPick={() => { setPick(c.employee.id); setTakeFrom(''); }} />)}
              {!list.length && <li className="py-6 text-center text-sm text-muted-foreground">Nobody matches</li>}
            </ul>
          )}
          {chosen && (
            <div className="space-y-2 rounded-xl border border-primary/30 bg-primary-soft/30 p-3">
              <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                <Field label="Allocation" htmlFor="fill-alloc">
                  <div className="relative">
                    <Input id="fill-alloc" type="number" min={1} max={r.allocation ?? 100} value={allocation} onChange={(e) => setAllocation(Math.max(1, Math.min(r.allocation ?? 100, Number(e.target.value) || 1)))} className="pr-7" />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                </Field>
                <Field label={lower ? 'Note for the Lead (required — lower than asked)' : 'Note (optional)'} htmlFor="fill-note">
                  <Input id="fill-note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder={lower ? `e.g. Only ${allocation}% free until December` : ''} />
                </Field>
              </div>
              {short > 0 && (
                <div className="rounded-lg bg-warning-soft p-2.5 text-xs">
                  <p className="mb-1.5 font-semibold text-warning">{chosen.employee.firstName} has {chosen.free}% free — free up {short}% from one of their projects:</p>
                  <Select value={takeFrom} onChange={(e) => setTakeFrom(e.target.value)} className="h-8 text-xs">
                    <option value="">Pick a project…</option>
                    {chosen.projects.filter((p) => p.allocation >= short).map((p) => <option key={p.memberId} value={p.memberId}>{p.name} · {p.allocation}% → {p.allocation - short}%</option>)}
                  </Select>
                  {source && <p className="mt-1.5 text-muted-foreground">If {source.name} isn’t yours, its project manager is asked to agree first.</p>}
                </div>
              )}
            </div>
          )}
        </section>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {r.can.reject && <Button variant="secondary" className="text-destructive" onClick={() => setDialog('reject')} disabled={busy}><X /> Reject</Button>}
        {r.can.hold && <Button variant="secondary" onClick={() => setDialog('hold')} disabled={busy}><Pause /> Hold</Button>}
        <span className="flex-1" />
        {r.can.forward && <Button variant="secondary" onClick={() => void doForward()} loading={forward.isPending} disabled={busy}>Approve → {NEXT[r.step]} <ArrowRight /></Button>}
        {r.can.fill && (
          <Button onClick={() => void doFill()} loading={fill.isPending} disabled={busy || !chosen || !chosen.underMe || (short > 0 && !source) || (lower && !note.trim())}>
            <UserCheck /> {chosen ? `Fill with ${chosen.employee.firstName} · ${allocation}%` : 'Pick someone to fill it'}
          </Button>
        )}
      </div>
      {dialog && (
        <ReasonDialog
          kind={dialog}
          busy={hold.isPending || reject.isPending}
          onClose={() => setDialog(null)}
          onSubmit={async (reason, remindAt) => {
            if (dialog === 'hold') await hold.mutateAsync({ id: r.id, reason, remindAt });
            else await reject.mutateAsync({ id: r.id, reason });
            toast.success(dialog === 'hold' ? 'On hold — the Lead is told why' : 'Rejected — the Lead is told why');
            onDone?.();
          }}
        />
      )}
    </div>
  );
}

function CandidateRow({ c, want, picked, onPick }: { c: Candidate; want: number; picked: boolean; onPick: () => void }) {
  const booked = 100 - c.free;
  const locked = !c.underMe;
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={picked}
        disabled={locked}
        onClick={onPick}
        title={locked ? 'Not on your projects — only the PMO can assign them. Approve it onward instead.' : undefined}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
          picked ? 'border-primary bg-primary-soft/40' : 'border-border hover:bg-subtle',
          locked && 'cursor-not-allowed border-dashed opacity-60 hover:bg-transparent',
          c.preferred && !picked && 'border-primary/40',
        )}
      >
        <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', picked ? 'border-primary bg-primary' : 'border-border')}>{picked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span>
        <PersonAvatar person={c.employee} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <b className="truncate text-sm">{c.employee.firstName} {c.employee.lastName}</b>
            {c.preferred && <Badge tone="primary">Preferred</Badge>}
            {c.match !== null && <Badge tone={c.match >= 60 ? 'success' : c.match > 0 ? 'info' : 'neutral'}>{c.match}% match</Badge>}
            {locked && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground"><Lock className="h-3 w-3" /> PMO only</span>}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {c.employee.designation?.name ?? '—'}
            {c.matchedSkills.length > 0 && ` · ${c.matchedSkills.join(', ')}`}
            {c.projects.length > 0 && ` · on ${c.projects.map((p) => `${p.name} ${p.allocation}%`).join(', ')}`}
          </span>
        </span>
        <span className="w-24 shrink-0 text-right">
          <span className={cn('block text-xs font-semibold tabular-nums', c.free >= want ? 'text-success' : c.free > 0 ? 'text-warning' : 'text-destructive')}>{c.free}% free</span>
          <LoadBar booked={booked} className="mt-1" />
        </span>
      </button>
    </li>
  );
}

function ConsentBox({ r }: { r: RequestDetail }) {
  const consent = useConsent();
  const [note, setNote] = useState('');
  const p = r.pendingFill!;
  const go = async (agree: boolean) => {
    try {
      await consent.mutateAsync({ id: r.id, agree, note: note.trim() || null });
      toast.success(agree ? `${p.employee?.firstName} joins ${r.project.name}` : 'Declined — they’ll pick someone else');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };
  return (
    <section className="space-y-2 rounded-xl border border-warning/40 bg-warning-soft/40 p-4">
      <p className="text-sm"><b>{p.by?.firstName}</b> wants <b>{p.employee?.firstName} {p.employee?.lastName}</b> on {r.project.name} at {p.allocation}%. That cuts their time on <b>{p.project}</b> to {p.takeFrom?.allocation}% from {r.fromDate && formatDate(r.fromDate)}.</p>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => void go(false)} loading={consent.isPending}>Decline</Button>
        <Button onClick={() => void go(true)} loading={consent.isPending}><Check /> Agree</Button>
      </div>
    </section>
  );
}

function UnholdBox({ r }: { r: RequestDetail }) {
  const unhold = useUnhold();
  const [note, setNote] = useState('');
  return (
    <section className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3">
      <Field label="Ready to decide? Unhold it first" htmlFor="unhold-note" className="min-w-[14rem] flex-1">
        <Input id="unhold-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional), e.g. Budget approved" />
      </Field>
      <Button
        onClick={async () => {
          try {
            await unhold.mutateAsync({ id: r.id, note: note.trim() || null });
            toast.success('Off hold — now approve, fill or reject it');
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not unhold'));
          }
        }}
        loading={unhold.isPending}
      >
        <Play /> Unhold
      </Button>
    </section>
  );
}

// ─── Release decision ─────────────────────────────────────

function DecideRelease({ r, onDone }: { r: RequestDetail; onDone?: () => void }) {
  const decide = useDecideRelease();
  const hold = useHold();
  const [outcome, setOutcome] = useState<'pool' | 'reassign' | 'keep'>('pool');
  const [target, setTarget] = useState(r.releaseTargets[0]?.id ?? '');
  const [allocation, setAllocation] = useState(100);
  const [start, setStart] = useState('');
  const [note, setNote] = useState('');
  const [holding, setHolding] = useState(false);
  const options = [
    { id: 'pool' as const, title: 'Send to the PMO pool', text: `Their time here ends ${r.lastDate ? formatDate(r.lastDate) : ''}; the PMO finds their next project.` },
    { id: 'reassign' as const, title: 'Move to one of my projects', text: r.releaseTargets.length ? 'Starts the day after their last day here (or pick a date).' : 'You have no other projects to move them to.' },
    { id: 'keep' as const, title: 'Keep them here', text: 'The Lead is told why. The person isn’t told anything.' },
  ];
  const go = async () => {
    try {
      await decide.mutateAsync({ id: r.id, outcome, targetProjectId: outcome === 'reassign' ? target : null, allocation: outcome === 'reassign' ? allocation : null, startDate: outcome === 'reassign' && start ? start : null, note: note.trim() || null });
      toast.success(outcome === 'pool' ? 'Sent to the PMO pool' : outcome === 'reassign' ? 'Moved — they’re told now' : 'Kept — the Lead is told why');
      onDone?.();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not decide'));
    }
  };
  return (
    <section className="space-y-3">
      {r.can.decideRelease && (
        <>
          <div className="grid gap-2" role="radiogroup" aria-label="Decision">
            {options.map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={outcome === o.id} disabled={o.id === 'reassign' && !r.releaseTargets.length} onClick={() => setOutcome(o.id)} className={cn('rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50', outcome === o.id ? 'border-primary bg-primary-soft/40' : 'border-border hover:bg-subtle')}>
                <b className="block text-sm">{o.title}</b>
                <span className="text-xs text-muted-foreground">{o.text}</span>
              </button>
            ))}
          </div>
          {outcome === 'reassign' && (
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Project" htmlFor="ra-proj"><Select id="ra-proj" value={target} onChange={(e) => setTarget(e.target.value)}>{r.releaseTargets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
              <Field label="Allocation %" htmlFor="ra-alloc"><Input id="ra-alloc" type="number" min={1} max={100} value={allocation} onChange={(e) => setAllocation(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} /></Field>
              <Field label="Starts" htmlFor="ra-start"><DateInput id="ra-start" value={start} min={r.lastDate ?? undefined} onChange={(e) => setStart(e.target.value)} placeholder="Day after last day" /></Field>
            </div>
          )}
          <Field label={outcome === 'keep' ? 'Why they stay (required)' : 'Note (optional)'} htmlFor="ra-note"><Textarea id="ra-note" value={note} rows={2} maxLength={1000} onChange={(e) => setNote(e.target.value)} /></Field>
        </>
      )}
      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {r.can.hold && <Button variant="secondary" onClick={() => setHolding(true)}><Pause /> Hold</Button>}
        <span className="flex-1" />
        {r.can.decideRelease && <Button onClick={() => void go()} loading={decide.isPending} disabled={outcome === 'keep' && !note.trim()}>{outcome === 'pool' ? 'Send to PMO pool' : outcome === 'reassign' ? 'Move them' : 'Keep them'}</Button>}
      </div>
      {holding && (
        <ReasonDialog
          kind="hold"
          busy={hold.isPending}
          onClose={() => setHolding(false)}
          onSubmit={async (reason, remindAt) => {
            await hold.mutateAsync({ id: r.id, reason, remindAt });
            toast.success('On hold — the Lead is told why');
            onDone?.();
          }}
        />
      )}
    </section>
  );
}

/** Withdraw (Lead), nudge (PMO), raise again (after a rejection). */
function SideActions({ r, onAgain }: { r: RequestDetail; onAgain: () => void }) {
  const withdraw = useWithdraw();
  const nudge = useNudge();
  if (!r.can.withdraw && !r.can.nudge && !r.can.raiseAgain) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {r.can.raiseAgain && <Button variant="secondary" onClick={onAgain}><RotateCcw /> Raise again</Button>}
      {r.can.nudge && (
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await nudge.mutateAsync(r.id);
              toast.success('Nudged the PM and Delivery Director');
            } catch (err) {
              toast.error(getApiErrorMessage(err, 'Could not nudge'));
            }
          }}
          loading={nudge.isPending}
        >
          <BellRing /> Nudge PM / DD
        </Button>
      )}
      {r.can.withdraw && (
        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={async () => {
            if (!window.confirm('Withdraw this? Everyone on the way is told.')) return;
            try {
              await withdraw.mutateAsync({ id: r.id });
              toast.success('Withdrawn');
            } catch (err) {
              toast.error(getApiErrorMessage(err, 'Could not withdraw'));
            }
          }}
          loading={withdraw.isPending}
        >
          <Undo2 /> Withdraw
        </Button>
      )}
    </div>
  );
}

/** Every step: raised, approved, held / unheld (with reasons), filled… and how long it waited. */
export function Timeline({ r, bare }: { r: RequestDetail; bare?: boolean }) {
  const rows = useMemo(() => r.events.map((e, i) => ({ ...e, waited: i > 0 ? Math.round((Date.parse(e.at) - Date.parse(r.events[i - 1]!.at)) / 3_600_000) : null })), [r.events]);
  return (
    <section className={cn(!bare && 'rounded-xl border border-border p-4')}>
      {!bare && <h3 className="mb-3 text-sm font-semibold">History</h3>}
      <ol className="relative space-y-3 border-l border-border pl-5">
        {rows.map((e) => (
          <li key={e.id} className="relative">
            <span className={cn('absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-raised', e.kind === 'rejected' || e.kind === 'consent_declined' ? 'bg-destructive' : e.kind === 'held' ? 'bg-warning' : e.kind === 'filled' || e.kind === 'consent_given' ? 'bg-success' : 'bg-primary')} />
            <p className="text-sm">
              <b>{e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : 'System'}</b> {EVENT_TEXT[e.kind] ?? e.kind}
              {e.kind === 'forwarded' && e.data && ` to the ${(e.data as { to?: string }).to === 'DD' ? 'Delivery Director' : 'PMO'}`}
            </p>
            {e.note && <p className="text-xs text-muted-foreground">“{e.note}”</p>}
            <p className="flex items-center gap-1 text-2xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" /> {formatDate(e.at)} · {new Date(e.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              {e.waited !== null && e.waited >= 1 && <span>· after {e.waited >= 48 ? `${Math.round(e.waited / 24)} days` : `${e.waited} h`}</span>}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
