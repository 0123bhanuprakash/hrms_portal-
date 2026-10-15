'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRightLeft, Check, Heart, Info, Plane, ShieldCheck, UserCheck, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { Field, FormError, Input } from '@/components/ui/field';
import { DateInput } from '@/components/ui/pickers';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useAccess } from '@/lib/access/use-access';
import { PersonSearch } from '@/components/people/person-search';
import {
  useAllDelegations,
  useAway,
  useCoverSuggestions,
  useCreateDelegation,
  useDelegationGaps,
  useDelegationRecap,
  useDelegationTimeline,
  useMyDelegations,
  useRevokeDelegation,
  type Delegation,
  type TimelineRow,
} from '@/lib/company/advanced';
import { useUiState } from '@/lib/preferences/ui-state';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/cn';

const KIND: Record<string, string> = { 'leave.approve': 'Leave', 'attendance.approve': 'Attendance fixes', 'expense.approve': 'Expenses', 'timesheet.approve': 'Timesheets' };
const STATUS: Record<Delegation['status'], { label: string; tone: 'success' | 'info' | 'neutral' }> = {
  active: { label: 'Covering now', tone: 'success' },
  upcoming: { label: 'Upcoming', tone: 'info' },
  ended: { label: 'Ended', tone: 'neutral' },
  revoked: { label: 'Ended early', tone: 'neutral' },
};
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (k: string, n: number) => {
  const d = new Date(`${k}T00:00:00`);
  d.setDate(d.getDate() + n);
  return keyOf(d);
};
const short = (k: string) => new Date(`${k.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const kindsOf = (p: Delegation['permissions']) => (p as Array<string | { key: string }>).map((x) => (typeof x === 'string' ? x : x.key));
const isList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

export default function DelegationsPage() {
  const { can } = useAccess();
  const me = useMyDelegations();
  const away = useAway();
  const isAdmin = can('user.view');
  const formRef = useRef<HTMLDivElement>(null);
  const [prefill, setPrefill] = useState<{ from: string; to: string; reason: string } | null>(null);

  if (me.isLoadingError) return <ErrorState message={getApiErrorMessage(me.error, 'Could not load delegations')} onRetry={() => me.refetch()} />;

  const covering = me.data?.received.filter((d) => d.status === 'active' || d.status === 'upcoming') ?? [];
  const uncovered = (away.data ?? []).find((l) => !l.coveredBy);
  const coveredTrip = (away.data ?? []).find((l) => l.coveredBy);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Settings" title="Delegation" description="Going away? Hand your approvals to a colleague — they cover for you, then it ends by itself." />

      {me.data?.canDelegate && uncovered && (
        <div className="m-rise flex flex-wrap items-center gap-4 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary-soft to-success-soft/50 px-5 py-4">
          <span className="text-4xl" aria-hidden>🏖️</span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold">You’re off {short(uncovered.from)}{uncovered.to !== uncovered.from ? ` – ${short(uncovered.to)}` : ''}</p>
            <p className="text-sm text-muted-foreground">{uncovered.type} · approved · {uncovered.inDays <= 0 ? 'started' : `in ${uncovered.inDays} day${uncovered.inDays === 1 ? '' : 's'}`} — nobody covers your approvals yet.</p>
          </div>
          <Button
            onClick={() => {
              setPrefill({ from: uncovered.from, to: uncovered.to, reason: uncovered.type });
              formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <ArrowRightLeft /> Find someone to cover
          </Button>
        </div>
      )}
      {!uncovered && coveredTrip && (
        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-soft/40 px-4 py-3 text-sm">
          <Check className="h-4 w-4 text-success" />
          <span><b>{coveredTrip.coveredBy!.name}</b> covers your approvals while you’re off {short(coveredTrip.from)} – {short(coveredTrip.to)}.</span>
        </div>
      )}

      <Recap />

      {covering.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {covering.map((d) => <CoveringCard key={d.id} d={d} />)}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          <TeamTimeline />
          <Card>
            <CardHeader title="Handed over" description="Your approvals someone else covers." icon={<ArrowRightLeft />} />
            {me.isLoading ? (
              <div className="space-y-2 p-4"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
            ) : !me.data?.given.length ? (
              <EmptyState icon={<Plane />} title="Nothing handed over" description={me.data?.canDelegate ? 'Use the form to hand over your approvals while you’re away.' : 'You have no approvals to hand over.'} />
            ) : (
              <HandoverList items={me.data.given} show="delegate" />
            )}
          </Card>
        </div>

        <div ref={formRef} className="scroll-mt-20 xl:sticky xl:top-20 xl:self-start">
          {me.data?.canDelegate ? (
            <HandOverForm delegable={me.data.delegable} prefill={prefill} />
          ) : (
            <Card className="flex items-start gap-3 p-5 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Delegation is for people who approve leave, attendance, expenses or timesheets (e.g. managers and team leads). Your roles don’t include approvals.</p>
            </Card>
          )}
        </div>
      </div>

      {isAdmin && <CompanyView canSetUp={can('user.edit')} />}
    </div>
  );
}

// ─── Covering for someone ───────────────────────────────────

function CoveringCard({ d }: { d: Delegation }) {
  const total = Math.max(1, (Date.parse(d.endsAt) - Date.parse(d.startsAt)) / 864e5);
  const left = Math.max(0, Math.ceil((Date.parse(d.endsAt) - Date.now()) / 864e5));
  const share = d.status === 'active' ? left / total : 1;
  const r = 26;
  const c = 2 * Math.PI * r;
  const kinds = kindsOf(d.permissions);
  return (
    <Card className="flex items-center gap-4 border-success/30 p-4">
      <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0" aria-label={`${left} days left`}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="hsl(var(--success))" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - share)} transform="rotate(-90 32 32)" className="transition-[stroke-dashoffset] duration-700" />
        <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor">{d.status === 'active' ? `${left}d` : '…'}</text>
      </svg>
      <div className="min-w-0 flex-1 text-sm">
        <p className="flex items-center gap-1.5 font-semibold"><UserCheck className="h-4 w-4 text-success" /> You’re covering for {d.delegator.name}</p>
        <p className="text-xs text-muted-foreground">{short(d.startsAt)} – {short(d.endsAt)} · {kinds.length ? kinds.map((k) => KIND[k] ?? k).join(', ') : 'all their approvals'}</p>
        {d.reason && <p className="mt-1 text-xs italic">“{d.reason}”</p>}
      </div>
      {d.status === 'active' && (
        <Button size="sm" variant="secondary" asChild>
          <Link href="/app/leave/approvals">Open approvals</Link>
        </Button>
      )}
    </Card>
  );
}

// ─── Welcome back ───────────────────────────────────────────

function Recap() {
  const recap = useDelegationRecap();
  const [seen, setSeen] = useUiState<string[]>('delegation.recap.seen', [], isList);
  const items = (recap.data ?? []).filter((r) => !seen.includes(r.id));
  if (!items.length) return null;
  const r = items[0]!;
  return (
    <Card className="m-rise space-y-3 border-success/30 bg-gradient-to-br from-success-soft/50 to-transparent p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>👋</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Welcome back — while you were away</p>
          <p className="text-sm text-muted-foreground">{r.delegate.name} covered {short(r.from)} – {short(r.to)} and decided {r.approved + r.rejected} request{r.approved + r.rejected === 1 ? '' : 's'} for you.</p>
        </div>
        <button type="button" aria-label="Hide" onClick={() => setSeen([...seen, r.id])} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
        <div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted-foreground">Approved</p><p className="text-2xl font-semibold text-success">{r.approved}</p></div>
        <div className="rounded-lg bg-surface p-3"><p className="text-xs text-muted-foreground">Rejected</p><p className="text-2xl font-semibold text-destructive">{r.rejected}</p></div>
      </div>
      {r.items.length > 0 && (
        <ul className="space-y-1 text-sm m-stagger">
          {r.items.map((i, k) => (
            <li key={k} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{i.title}</span>
              <b className={i.approved ? 'text-success' : 'text-destructive'}>{i.approved ? 'Approved' : 'Rejected'}</b>
            </li>
          ))}
        </ul>
      )}
      <Button size="sm" variant="secondary" asChild>
        <Link href="/app/kudos"><Heart /> Say thanks to {r.delegate.name.split(' ')[0]}</Link>
      </Button>
    </Card>
  );
}

// ─── Team timeline (next 3 weeks) ───────────────────────────

function TeamTimeline() {
  const today = keyOf(new Date());
  const to = addDays(today, 20);
  const t = useDelegationTimeline(today, to);
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(today, i)), [today]);
  if (t.isLoading) return <Skeleton className="h-48" />;
  const rows = t.data?.rows ?? [];
  if (rows.length <= 1 && !rows[0]?.off.length) return null;
  const span = (a: string, b: string) => {
    const s = Math.max(0, days.indexOf(a < today ? today : a));
    const e = b > to ? 20 : days.indexOf(b);
    return { left: `${(s / 21) * 100}%`, width: `${((e - s + 1) / 21) * 100}%` };
  };
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <p className="flex-1 text-sm font-semibold">Your team’s next 3 weeks</p>
        <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><i className="h-2.5 w-4 rounded-sm bg-pink-500/80" /> Away</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-4 rounded-sm border border-dashed border-teal-500" /> Covered</span>
          <span className="flex items-center gap-1"><i className="h-2.5 w-4 rounded-sm border border-dashed border-warning" /> No cover</span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[620px] space-y-1.5">
          <div className="grid grid-cols-[130px_1fr] items-end gap-2">
            <span />
            <div className="grid grid-cols-[repeat(21,minmax(0,1fr))] text-center text-[9.5px] text-muted-foreground">
              {days.map((d) => (
                <span key={d} className={cn(d === today && 'font-bold text-primary')}>{+d.slice(8)}</span>
              ))}
            </div>
          </div>
          {rows.map((row: TimelineRow) => (
            <div key={row.employeeId} className="grid grid-cols-[130px_1fr] items-center gap-2">
              <span className="flex min-w-0 items-center gap-1.5 text-xs">
                <PersonAvatar person={row} size="xs" />
                <b className="truncate">{row.isMe ? 'You' : row.firstName}</b>
              </span>
              <div className="relative h-7 rounded-md bg-muted/60">
                {row.off.map((o, i) => (
                  <i key={`o${i}`} className="absolute top-1 h-2.5 rounded-sm bg-pink-500/80 m-fill-w" style={span(o.from, o.to)} title={`Away ${short(o.from)} – ${short(o.to)}`} />
                ))}
                {row.covers.map((c, i) => (
                  <i key={`c${i}`} className="absolute bottom-0.5 flex h-3 items-center overflow-hidden whitespace-nowrap rounded-sm border border-dashed border-teal-500 px-1 text-[8.5px] font-semibold not-italic text-teal-600" style={span(c.from, c.to)}>
                    {c.by.split(' ')[0]} covers
                  </i>
                ))}
                {row.gaps.map((g, i) => (
                  <i key={`g${i}`} className="absolute bottom-0.5 flex h-3 items-center overflow-hidden whitespace-nowrap rounded-sm border border-dashed border-warning px-1 text-[8.5px] font-semibold not-italic text-warning" style={span(g.from, g.to)}>
                    no cover yet
                  </i>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Hand over (the form) ───────────────────────────────────

function HandOverForm({ delegable, prefill }: { delegable: Array<{ key: string; label: string }>; prefill: { from: string; to: string; reason: string } | null }) {
  const today = keyOf(new Date());
  const myId = useAuthStore((s) => s.user?.id);
  const create = useCreateDelegation();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 6));
  const [who, setWho] = useState('');
  const [kinds, setKinds] = useState<string[]>(delegable.map((d) => d.key));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fromLeave, setFromLeave] = useState(false);
  const suggestions = useCoverSuggestions(from, to);

  useEffect(() => {
    if (!prefill) return;
    setFrom(prefill.from < today ? today : prefill.from);
    setTo(prefill.to);
    setReason(prefill.reason);
    setFromLeave(true);
  }, [prefill, today]);
  useEffect(() => setKinds(delegable.map((d) => d.key)), [delegable]);

  const top = suggestions.data ?? [];
  const chosen = top.find((s) => s.userId === who);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!who) return setError('Choose who covers');
    if (!kinds.length) return setError('Tick at least one kind of approval');
    create.mutate(
      {
        delegateId: who,
        ...(from > today && { startsAt: new Date(`${from}T00:00:00`).toISOString() }),
        endsAt: new Date(`${to}T23:59:59`).toISOString(),
        reason: reason.trim() || undefined,
        ...(kinds.length < delegable.length && { permissions: kinds }),
      },
      {
        onSuccess: (d) => {
          toast.success(`${d.delegate.name} covers your approvals ${short(from)} – ${short(to)}`);
          setWho('');
          setFromLeave(false);
        },
        onError: (err) => setError(getApiErrorMessage(err, 'Could not hand over')),
      },
    );
  };

  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 font-semibold"><ArrowRightLeft className="h-4 w-4 text-primary" /> Hand over my approvals</p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <FormError>{error}</FormError>
        <Step n={1} title="When">
          <div className="grid grid-cols-2 gap-2">
            <DateInput aria-label="From" value={from} min={today} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); setFromLeave(false); }} />
            <DateInput aria-label="Until" value={to} min={from} onChange={(e) => { setTo(e.target.value); setFromLeave(false); }} />
          </div>
          {fromLeave && <p className="flex items-center gap-1 text-xs text-success"><Check className="h-3 w-3" /> Filled in from your approved leave</p>}
        </Step>
        <Step n={2} title="Who covers — best fits">
          {suggestions.isLoading ? (
            <Skeleton className="h-28" />
          ) : (
            <div className="space-y-1.5">
              {top.slice(0, 4).map((s) => (
                <button
                  key={s.userId}
                  type="button"
                  aria-pressed={who === s.userId}
                  onClick={() => setWho(s.userId)}
                  className={cn('flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all', who === s.userId ? 'border-primary bg-primary-soft/50 ring-1 ring-primary/30' : 'border-border hover:bg-muted/50', s.awayDays > 0 && 'opacity-60')}
                >
                  <PersonAvatar person={s} size="sm" />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{s.firstName} {s.lastName}</b>
                    <span className="block truncate text-xs text-muted-foreground">{s.reasons.join(' · ') || s.title}</span>
                    <span className={cn('block text-xs', s.awayDays ? 'text-destructive' : 'text-success')}>{s.available}</span>
                  </span>
                  {who === s.userId && <Check className="h-4 w-4 text-primary adm-land" />}
                </button>
              ))}
            </div>
          )}
          <PersonSearch by="user" aria-label="Someone else" value={chosen ? '' : who} onChange={(id) => setWho(id)} placeholder="Someone else…" hide={myId ? [myId] : undefined} />
        </Step>
        <Step n={3} title="What they approve">
          <div className="flex flex-wrap gap-1.5">
            {delegable.map((d) => {
              const on = kinds.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setKinds(on ? kinds.filter((k) => k !== d.key) : [...kinds, d.key])}
                  className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors', on ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted-foreground line-through')}
                >
                  {on && <Check className="h-3 w-3" />}
                  {KIND[d.key] ?? d.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">All are on — untick anything you’d rather do yourself when you’re back.</p>
        </Step>
        <Field label="Note for them" htmlFor="dl-note">
          <Input id="dl-note" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Ask Rahul about the release week" />
        </Field>
        <Button type="submit" className="w-full" loading={create.isPending}>
          <ArrowRightLeft /> Hand over {short(from)} – {short(to)}
        </Button>
        <p className="text-xs text-muted-foreground">Up to 90 days. You can end it early any time. Nobody can approve their own requests.</p>
      </form>
    </Card>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-soft text-[11px] text-primary">{n}</span>
        {title}
      </p>
      {children}
    </section>
  );
}

// ─── Lists ──────────────────────────────────────────────────

function HandoverList({ items, show }: { items: Delegation[]; show: 'delegate' | 'both' }) {
  const revoke = useRevokeDelegation();
  return (
    <ul className="divide-y divide-border border-t border-border">
      {items.map((d) => {
        const total = Date.parse(d.endsAt) - Date.parse(d.startsAt);
        const done = d.status === 'active' ? Math.min(1, (Date.now() - Date.parse(d.startsAt)) / total) : d.status === 'upcoming' ? 0 : 1;
        const kinds = kindsOf(d.permissions);
        return (
          <li key={d.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {show === 'both' ? <>{d.delegator.name} <ArrowRightLeft className="inline h-3.5 w-3.5 text-muted-foreground" /> {d.delegate.name}</> : <>To {d.delegate.name}</>}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(d.startsAt)} – {formatDate(d.endsAt)} · {kinds.length ? kinds.map((k) => KIND[k] ?? k).join(', ') : 'all approvals'}
                {d.reason ? ` · ${d.reason}` : ''}
              </p>
              <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted"><i className="block h-full rounded-full bg-primary m-fill-w" style={{ width: `${done * 100}%` }} /></span>
            </div>
            <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
            {(d.status === 'active' || d.status === 'upcoming') && (
              <Button
                variant="ghost"
                size="sm"
                loading={revoke.isPending && revoke.variables === d.id}
                onClick={() =>
                  revoke.mutate(d.id, {
                    onSuccess: () => toast.success(`Ended — ${d.delegate.name} no longer covers for ${d.delegator.name}`),
                    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not end it')),
                  })
                }
              >
                <X /> End now
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ─── Company view (admins) ──────────────────────────────────

function CompanyView({ canSetUp }: { canSetUp: boolean }) {
  const [page, setPage] = useState(1);
  const all = useAllDelegations(true, page);
  const gaps = useDelegationGaps(true);
  const today = keyOf(new Date());
  const end = addDays(today, 30);
  const pos = (iso: string) => Math.min(100, Math.max(0, ((Date.parse(iso) - Date.parse(`${today}T00:00:00`)) / (Date.parse(`${end}T00:00:00`) - Date.parse(`${today}T00:00:00`))) * 100));
  const rows = [
    ...(all.data?.rows ?? []).map((d) => ({ key: d.id, label: `${d.delegator.name.split(' ')[0]} → ${d.delegate.name.split(' ')[0]}`, a: d.startsAt, b: d.endsAt, gap: false, status: d.status })),
    ...(gaps.data?.rows ?? []).map((g) => ({ key: `${g.userId}${g.from}`, label: `${g.name.split(' ')[0]} → ?`, a: `${g.from}T00:00:00`, b: `${g.to}T23:59:59`, gap: true, status: 'gap' as const })),
  ];
  return (
    <Card>
      <CardHeader title="Company hand-overs" description="Next 30 days. Striped = an approver on leave with nobody covering." icon={<ShieldCheck />} />
      {all.isLoading ? (
        <div className="p-4"><Skeleton className="h-24" /></div>
      ) : !rows.length ? (
        <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">No hand-overs and no gaps in the next 30 days.</p>
      ) : (
        <div className="space-y-1.5 border-t border-border p-4">
          <div className="grid grid-cols-[160px_1fr] gap-2 text-[10px] text-muted-foreground">
            <span />
            <div className="flex justify-between">{[0, 7, 14, 21, 30].map((n) => <span key={n}>{short(addDays(today, n))}</span>)}</div>
          </div>
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-[160px_1fr] items-center gap-2">
              <b className="truncate text-xs">{r.label}</b>
              <div className="relative h-6 rounded-md bg-muted/60">
                <i
                  className={cn('absolute inset-y-1 rounded-sm m-fill-w', r.gap ? 'bg-[repeating-linear-gradient(45deg,hsl(var(--warning)),hsl(var(--warning))_6px,hsl(var(--warning)/0.5)_6px,hsl(var(--warning)/0.5)_12px)]' : r.status === 'active' ? 'bg-success' : 'bg-info')}
                  style={{ left: `${pos(r.a)}%`, width: `${Math.max(1.5, pos(r.b) - pos(r.a))}%` }}
                  title={r.gap ? 'On leave — no cover' : r.status}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {(gaps.data?.total ?? 0) > (gaps.data?.rows.length ?? 0) && <p className="px-5 pb-2 text-xs text-muted-foreground">+{gaps.data!.total - gaps.data!.rows.length} more approvers on leave with nobody covering (showing the soonest {gaps.data!.rows.length}).</p>}
      {!!all.data?.rows.length && <HandoverList items={all.data.rows} show="both" />}
      {all.data && all.data.meta.totalPages > 1 && <Pagination page={all.data.meta.page} totalPages={all.data.meta.totalPages} total={all.data.meta.total} limit={all.data.meta.limit} onPageChange={setPage} />}
      {canSetUp && <OnBehalf />}
    </Card>
  );
}

function OnBehalf() {
  const create = useCreateDelegation();
  const today = keyOf(new Date());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 6));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!from || !to) return setError('Choose both people');
    create.mutate(
      { delegatorId: from, delegateId: to, ...(start > today && { startsAt: new Date(`${start}T00:00:00`).toISOString() }), endsAt: new Date(`${end}T23:59:59`).toISOString(), reason: reason.trim() || undefined },
      {
        onSuccess: (d) => {
          toast.success(`${d.delegate.name} covers ${d.delegator.name}'s approvals until ${formatDate(d.endsAt)}`);
          setTo('');
        },
        onError: (err) => setError(getApiErrorMessage(err, 'Could not set it up')),
      },
    );
  };
  return (
    <form onSubmit={submit} className="space-y-3 border-t border-border p-4">
      <p className="text-sm font-semibold">Set up on someone’s behalf</p>
      <FormError>{error}</FormError>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Whose approvals"><PersonSearch by="user" aria-label="Whose approvals" value={from} onChange={(id) => setFrom(id)} /></Field>
        <Field label="Who covers"><PersonSearch by="user" aria-label="Who covers" value={to} onChange={(id) => setTo(id)} hide={from ? [from] : undefined} /></Field>
        <Field label="From"><DateInput aria-label="From" value={start} min={today} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Until"><DateInput aria-label="Until" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <Field label="Reason" htmlFor="ob-reason"><Input id="ob-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Annual leave" /></Field>
      <Button type="submit" loading={create.isPending}><ArrowRightLeft /> Set up delegation</Button>
    </form>
  );
}
