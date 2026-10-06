'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Emoji } from '@/components/motion/emoji';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { BellRing, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Lock, MessageSquare, ShieldCheck, Undo2, Users, UserX } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { Field, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { blockColor, GENERAL_COLOR } from '@/components/timesheets/week-calendar';
import { Compliance } from '@/components/timesheets/compliance';
import { useAccess } from '@/lib/access/use-access';
import { useIsApprover } from '@/lib/company/projects';
import {
  TS_STATUS,
  addDays,
  clock,
  dayLabel,
  fmtHours,
  longDayLabel,
  mondayOf,
  todayKey,
  useApproveTime,
  useNudge,
  useSendBackTime,
  useTeamWeek,
  useWeek,
  weekLabel,
  type CellState,
} from '@/lib/company/timesheets';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

type View = 'team' | 'compliance';

export default function TimesheetApprovalsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Approvals />
    </Suspense>
  );
}

function Approvals() {
  const { can, scopeOf, hasFeature, isLoading: accessLoading } = useAccess();
  const isApprover = useIsApprover('leave.approve');
  const approver = isApprover || can('timesheet.approve');
  const seesTeam = can('timesheet.view') && scopeOf('timesheet.view') !== 'own';
  const [chosen, setView] = useState<View | null>(null);
  const view = chosen ?? (approver ? 'team' : 'compliance');
  const allowed = hasFeature('work.timesheets') && (approver || seesTeam);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" description="You don’t approve or review timesheets." />;
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Timesheets" title="Team timesheets" description="Time people logged on projects you lead (or PM when no lead is set), and General time from people you manage." />
      {seesTeam && (
        <Tabs
          tabs={[
            ...(approver ? [{ id: 'team' as const, label: 'Team week', icon: <Users /> }] : []),
            { id: 'compliance' as const, label: 'Who’s filled', icon: <UserX /> },
          ]}
          value={view}
          onChange={setView}
        />
      )}
      {view === 'compliance' ? <Compliance /> : <TeamGrid />}
    </div>
  );
}

const CELL: Record<CellState, { bg: string; fg: string; label: string }> = {
  waiting: { bg: 'bg-info/15', fg: 'text-info', label: 'Waiting on you' },
  approved: { bg: 'bg-success/15', fg: 'text-success', label: 'Approved' },
  back: { bg: 'bg-destructive/10', fg: 'text-destructive', label: 'Sent back' },
  draft: { bg: 'bg-muted', fg: 'text-muted-foreground', label: 'Not sent yet' },
  other: { bg: 'bg-subtle', fg: 'text-muted-foreground', label: 'Other projects only' },
  none: { bg: 'border border-dashed border-warning/60', fg: 'text-warning', label: 'Nothing logged' },
  leave: { bg: 'bg-primary-soft', fg: 'text-primary-soft-foreground', label: 'On leave' },
  off: { bg: '', fg: 'text-muted-foreground/40', label: 'Day off' },
  future: { bg: '', fg: 'text-muted-foreground/40', label: '' },
};

function TeamGrid() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const thisWeek = mondayOf(todayKey());
  const raw = params.get('week');
  const weekStart = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? mondayOf(raw) : thisWeek;
  const go = (w: string) => router.replace(`${pathname}${w === thisWeek ? '' : `?week=${w}`}`, { scroll: false });
  const q = useTeamWeek(weekStart);
  const [filter, setFilter] = useState<'waiting' | 'all' | 'missing'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const approve = useApproveTime();
  const nudge = useNudge();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  useEffect(() => setPicked(new Set()), [weekStart]);

  const rows = useMemo(() => {
    const all = q.data?.people ?? [];
    return filter === 'waiting' ? all.filter((r) => r.waitingDays) : filter === 'missing' ? all.filter((r) => r.missingDays) : all;
  }, [q.data, filter]);

  const bulk = async () => {
    try {
      const r = await approve.mutateAsync({ employeeIds: [...picked], dates });
      toast.success(`Approved ${r.decided} block${r.decided === 1 ? '' : 's'}`);
      setPicked(new Set());
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not approve'));
    }
  };

  const s = q.data?.summary;
  return (
    <div className="space-y-4">
      {s && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Waiting on you', `${s.waitingDays} day${s.waitingDays === 1 ? '' : 's'}`, `${s.waitingPeople} ${s.waitingPeople === 1 ? 'person' : 'people'}`, 'text-info'],
            ['Not logged yet', `${s.notLogged} ${s.notLogged === 1 ? 'person' : 'people'}`, 'working days with nothing logged', 'text-warning'],
            ['Sent back', `${s.sentBack} day${s.sentBack === 1 ? '' : 's'}`, 'waiting for them to fix', 'text-destructive'],
            ['Team this week', fmtHours(s.totalMinutes), s.totalMinutes ? `${Math.round((s.billableMinutes / s.totalMinutes) * 100)}% billable` : '—', 'text-success'],
          ].map(([l, v, sub, c]) => (
            <Card key={l} className="px-4 py-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold">{v}</p><p className={cn('text-xs font-semibold', c)}>{sub}</p></Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="secondary" aria-label="Previous week" onClick={() => go(addDays(weekStart, -7))}><ChevronLeft /></Button>
        <span className="min-w-[140px] text-center text-sm font-semibold">{weekLabel(weekStart)}</span>
        <Button size="icon-sm" variant="secondary" aria-label="Next week" disabled={weekStart >= thisWeek} onClick={() => go(addDays(weekStart, 7))}><ChevronRight /></Button>
        {(['all', 'waiting', 'missing'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f} className={cn('rounded-full border px-3 py-1 text-xs font-semibold', filter === f ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border hover:bg-subtle')}>
            {f === 'all' ? `Everyone · ${q.data?.people.length ?? 0}` : f === 'waiting' ? `Waiting on me · ${s?.waitingPeople ?? 0}` : `Not logged · ${s?.notLogged ?? 0}`}
          </button>
        ))}
        {picked.size > 0 && (
          <div className="ml-auto flex items-center gap-2 rounded-xl bg-foreground px-3 py-1.5 text-xs text-background">
            <b>{picked.size} selected</b>
            <Button size="sm" onClick={() => void bulk()} loading={approve.isPending} icon={<Check />}>Approve their waiting time</Button>
          </div>
        )}
      </div>

      {q.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : q.isError ? (
        <ErrorState message={getApiErrorMessage(q.error, 'Could not load')} onRetry={() => void q.refetch()} />
      ) : !rows.length ? (
        <EmptyState icon={<ClipboardCheck />} title={filter === 'all' ? 'Nobody’s time comes to you' : 'Nobody here'} description={filter === 'all' ? 'People show up here when you’re their team lead on a project, their PM (no lead set) or their manager.' : undefined} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[230px_repeat(7,minmax(0,1fr))_90px_120px] items-center border-b border-border bg-subtle/60 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <span>Person</span>
              {dates.map((d) => <span key={d} className="text-center">{dayLabel(d)}</span>)}
              <span className="text-right">Total</span>
              <span />
            </div>
            {rows.map((r) => {
              const isOpen = open === r.employee.id;
              return (
                <div key={r.employee.id} className={cn('border-b border-border/70 last:border-0', isOpen && 'bg-primary-soft/20')}>
                  <div className="grid grid-cols-[230px_repeat(7,minmax(0,1fr))_90px_120px] items-center gap-1 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <input
                        type="checkbox"
                        className="accent-[hsl(var(--primary))]"
                        disabled={!r.waitingDays}
                        checked={picked.has(r.employee.id)}
                        onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(r.employee.id); else n.delete(r.employee.id); return n; })}
                        aria-label={`Select ${r.employee.firstName}`}
                      />
                      <button type="button" onClick={() => setOpen(isOpen ? null : r.employee.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <PersonAvatar person={r.employee} size="sm" />
                        <span className="min-w-0">
                          <b className="block truncate text-sm">{r.employee.firstName} {r.employee.lastName}</b>
                          <span className="block truncate text-xs text-muted-foreground">{r.employee.designation?.name ?? r.employee.employeeId}</span>
                        </span>
                        <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                      </button>
                    </div>
                    {r.cells.map((c) => {
                      const st = CELL[c.state];
                      const shown = c.myMinutes || c.minutes;
                      return (
                        <span key={c.date} title={`${longDayLabel(c.date)} · ${st.label}${c.minutes ? ` · ${fmtHours(c.minutes)} logged${c.myMinutes && c.myMinutes !== c.minutes ? `, ${fmtHours(c.myMinutes)} for you` : ''}` : ''}`} className={cn('mx-0.5 rounded-md py-1.5 text-center text-xs font-bold tabular-nums', st.bg, st.fg)}>
                          {c.state === 'leave' ? <Emoji e="🌴" /> : c.state === 'none' ? '—' : c.state === 'off' || c.state === 'future' ? '·' : fmtHours(shown).replace(' ', '')}
                        </span>
                      );
                    })}
                    <span className="text-right text-sm"><b>{fmtHours(r.totalMinutes)}</b><span className="block text-[11px] text-muted-foreground">of {fmtHours(r.expectedMinutes)}</span></span>
                    <span className="text-right">
                      {r.waitingDays ? (
                        <Button size="sm" onClick={() => setOpen(r.employee.id)}>Review {r.waitingDays}</Button>
                      ) : r.missingDays ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<BellRing />}
                          loading={nudge.isPending && nudge.variables === r.employee.id}
                          onClick={async () => {
                            try {
                              const n = await nudge.mutateAsync(r.employee.id);
                              toast.success(n.sent ? `Reminded ${r.employee.firstName}` : `${r.employee.firstName} was already reminded today`);
                            } catch (err) {
                              toast.error(getApiErrorMessage(err, 'Could not send'));
                            }
                          }}
                        >
                          Nudge
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{r.cells.some((c) => c.state === 'approved') ? '✓ Approved' : ''}</span>
                      )}
                    </span>
                  </div>
                  {isOpen && <PersonWeek employeeId={r.employee.id} name={r.employee.firstName} weekStart={weekStart} />}
                </div>
              );
            })}
          </div>
        </Card>
      )}
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {(['waiting', 'approved', 'draft', 'back', 'none', 'leave'] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className={cn('h-3 w-4 rounded', CELL[k].bg)} />{CELL[k].label}</span>
        ))}
        <span className="ml-auto">You approve the projects where you’re the person’s lead (or PM when no lead is set)</span>
      </p>
    </div>
  );
}

/** One person's week: their blocks per day; tick the ones that are yours to decide. */
function PersonWeek({ employeeId, name, weekStart }: { employeeId: string; name: string; weekStart: string }) {
  const q = useWeek(weekStart, employeeId);
  const approve = useApproveTime();
  const sendBack = useSendBackTime();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [backOpen, setBackOpen] = useState(false);
  const [note, setNote] = useState('');
  const week = q.data;
  const mine = week?.blocks.filter((b) => b.canDecide) ?? [];
  useEffect(() => setSel(new Set(mine.map((b) => b.id))), [week]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading) return <div className="px-6 pb-4"><Skeleton className="h-32 w-full" /></div>;
  if (!week) return <p className="px-6 pb-4 text-sm text-destructive">{getApiErrorMessage(q.error, 'Could not load their week')}</p>;
  const days = week.days.filter((d) => week.blocks.some((b) => b.date === d.date));

  const doApprove = async (ids: string[]) => {
    try {
      const r = await approve.mutateAsync({ ids });
      toast.success(`Approved ${r.decided} block${r.decided === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not approve'));
    }
  };

  return (
    <div className="space-y-3 px-4 pb-4 sm:pl-12">
      {!days.length && <p className="text-sm text-muted-foreground">{name} hasn’t logged anything this week.</p>}
      {days.map((d) => {
        const blocks = week.blocks.filter((b) => b.date === d.date);
        const decide = blocks.filter((b) => b.canDecide);
        const others = blocks.filter((b) => !b.canDecide);
        const note1 = blocks.find((b) => b.submitNote)?.submitNote;
        return (
          <div key={d.date} className="rounded-xl border border-border bg-surface p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <b>{longDayLabel(d.date)} · {fmtHours(d.minutes)}</b>
              {d.attendance?.workingMinutes != null && <span className="text-muted-foreground">in office {fmtHours(d.attendance.workingMinutes)}{d.attendance.checkIn != null ? ` (${clock(d.attendance.checkIn)} – ${d.attendance.checkOut != null ? clock(d.attendance.checkOut) : '…'})` : ''}</span>}
              {note1 && <span className="ml-auto italic text-muted-foreground">Note: “{note1}”</span>}
            </div>
            <div className="space-y-1.5">
              {decide.map((b) => (
                <label key={b.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/70 border-l-4 bg-surface px-2.5 py-1.5 text-xs" style={{ borderLeftColor: b.project ? blockColor(b.project) : GENERAL_COLOR }}>
                  <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={sel.has(b.id)} onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(b.id); else n.delete(b.id); return n; })} />
                  <b className="w-16 shrink-0 truncate" style={{ color: b.project ? blockColor(b.project) : GENERAL_COLOR }}>{b.project?.code ?? 'General'}</b>
                  <span className="w-36 shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">{b.startMin != null ? `${clock(b.startMin)} – ${clock(b.endMin!)}` : '—'}</span>
                  <span className="min-w-0 flex-1 truncate">{b.description}{b.workType ? <span className="text-muted-foreground"> · {b.workType}</span> : null}</span>
                  <b className="tabular-nums">{fmtHours(b.minutes)}</b>
                </label>
              ))}
              {others.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                  <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="flex-1">
                    {others.map((b) => `${b.project?.name ?? 'General'} ${fmtHours(b.minutes)} — ${TS_STATUS[b.status].label.toLowerCase()}${b.decidedBy ? ` by ${b.decidedBy.firstName}` : b.status === 'SUBMITTED' && b.approvers.length ? ` (${b.approvers.map((a) => a.firstName).join(', ')})` : ''}`).join(' · ')}
                  </span>
                </div>
              )}
            </div>
            {decide.length > 0 && (
              <div className="mt-2 flex justify-end">
                <Button size="sm" variant="secondary" icon={<Check />} onClick={() => void doApprove(decide.map((b) => b.id))} loading={approve.isPending}>Approve {dayLabel(d.date)}</Button>
              </div>
            )}
          </div>
        );
      })}
      {mine.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-xs text-muted-foreground">{sel.size} of {mine.length} waiting block{mine.length === 1 ? '' : 's'} selected</span>
          <Button variant="secondary" className="text-destructive" icon={<Undo2 />} disabled={!sel.size} onClick={() => { setNote(''); setBackOpen(true); }}>Send back…</Button>
          <Button icon={<Check />} disabled={!sel.size} loading={approve.isPending} onClick={() => void doApprove([...sel])}>Approve selected</Button>
        </div>
      )}
      <Modal
        open={backOpen}
        onClose={() => setBackOpen(false)}
        busy={sendBack.isPending}
        title={`Send back to ${name}`}
        description={`${sel.size} block${sel.size === 1 ? '' : 's'} — they’ll see your note on ${sel.size === 1 ? 'it' : 'each one'}.`}
        icon={<MessageSquare />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBackOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={sendBack.isPending}
              disabled={note.trim().length < 3}
              onClick={async () => {
                try {
                  const r = await sendBack.mutateAsync({ ids: [...sel], note: note.trim() });
                  toast.success(`Sent back ${r.decided} block${r.decided === 1 ? '' : 's'}`);
                  setBackOpen(false);
                } catch (err) {
                  toast.error(getApiErrorMessage(err, 'Could not send back'));
                }
              }}
            >
              Send back
            </Button>
          </>
        }
      >
        <Field label="What needs changing?" htmlFor="back-note" required>
          <Textarea id="back-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Split this — part of it was the Atlas tax bug?" autoFocus />
        </Field>
      </Modal>
    </div>
  );
}

