'use client';

import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { CircleDot, Hourglass, Loader2, PartyPopper, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/feedback';
import { Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { TargetRing } from '@/components/helpdesk/ticket-visuals';
import { api } from '@/lib/api';
import { PRIORITY, dueText, helpdeskKeys, usePostMessage, useResolveTicket, useTicketPages, useTickets, type HelpdeskTeam, type Priority, type Queue, type Ticket } from '@/lib/company/helpdesk';
import { useAuthStore } from '@/store/useAuthStore';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

type Lane = 'new' | 'working' | 'waiting' | 'resolved';
const LANES: Array<{ id: Lane; label: string; icon: React.ReactNode; tone: string }> = [
  { id: 'new', label: 'New · not picked up', icon: <CircleDot />, tone: 'text-info' },
  { id: 'working', label: 'Working on it', icon: <Loader2 />, tone: 'text-primary' },
  { id: 'waiting', label: 'Waiting on employee', icon: <Hourglass />, tone: 'text-warning' },
  { id: 'resolved', label: 'Resolved · closes in 7 days', icon: <PartyPopper />, tone: 'text-success' },
];
const laneOf = (t: Ticket): Lane => (t.status === 'RESOLVED' ? 'resolved' : t.status === 'WAITING' ? 'waiting' : t.status === 'OPEN' && !t.assignee ? 'new' : 'working');

/** Same filters as the list; lanes by status, or (for team heads) by owner. Drag a card to move it. */
export function QueueBoard({ filters, teamOf, groupBy }: { filters: { queue?: Queue; priority?: Priority; search?: string }; teamOf: Map<Queue, HelpdeskTeam>; groupBy: 'status' | 'owner' }) {
  const me = useAuthStore((s) => s.user?.id);
  // Open tickets 100 at a time ("Load more"); the latest 30 resolved
  const active = useTicketPages({ view: 'queue', status: 'active', ...filters });
  const resolved = useTickets({ view: 'queue', status: 'RESOLVED', limit: 30, ...filters });
  const open = useMemo(() => active.data?.pages.flatMap((p) => p.data) ?? [], [active.data]);
  const openTotal = active.data?.pages[0]?.meta.total ?? 0;
  const all = useMemo(() => [...open, ...(resolved.data?.data ?? [])], [open, resolved.data]);
  const [drag, setDrag] = useState<Ticket | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ t: Ticket; to: 'waiting' | 'resolved' } | null>(null);
  const qc = useQueryClient();
  const owners = useOwners(all, teamOf);

  if (active.isLoading || resolved.isLoading) return <div className="grid gap-3 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-96" />)}</div>;

  // ── By status ──
  const statusRule = (t: Ticket, to: Lane): string | null => {
    const from = laneOf(t);
    if (from === to) return null;
    if (to === 'new') return t.canAssign ? null : 'Only the team head can unassign';
    if (to === 'working') {
      if (from === 'new') return t.canAssign ? null : 'Only the team head assigns tickets';
      return from === 'waiting' ? 'It moves back when the employee replies' : 'Reopening is up to the employee';
    }
    if (to === 'waiting') return t.canWork && t.status !== 'RESOLVED' ? null : t.status === 'RESOLVED' ? 'Reopening is up to the employee' : 'Not assigned to you';
    return t.canResolve ? null : 'Not assigned to you';
  };

  // ── By owner (heads) ──
  const ownerRule = (t: Ticket, to: string): string | null => {
    if ((t.assignee?.id ?? 'none') === to) return null;
    if (!t.canAssign) return 'Only the team head assigns tickets';
    if (to !== 'none' && !(teamOf.get(t.queue)?.members ?? []).some((m) => m.id === to && m.inQueue)) return 'Not in this ticket’s team';
    return null;
  };

  const lanes = groupBy === 'status'
    ? LANES.map((l) => ({ id: l.id, head: <span className={cn('flex items-center gap-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5', l.tone)}>{l.icon}<span className="text-foreground">{l.label}</span></span>, items: all.filter((t) => laneOf(t) === l.id) }))
    : owners.map((o) => ({ id: o.id, head: o.head, items: all.filter((t) => t.status !== 'RESOLVED' && (t.assignee?.id ?? 'none') === o.id) }));
  const rule = (t: Ticket, laneId: string) => (groupBy === 'status' ? statusRule(t, laneId as Lane) : ownerRule(t, laneId));

  return (
    <>
      <div className={cn('grid gap-3', groupBy === 'status' ? 'md:grid-cols-2 xl:grid-cols-4' : 'auto-cols-[minmax(240px,1fr)] grid-flow-col overflow-x-auto pb-2')}>
        {lanes.map((lane) => {
          const blocked = drag ? rule(drag, lane.id) : null;
          const same = drag && (groupBy === 'status' ? laneOf(drag) === lane.id : (drag.assignee?.id ?? 'none') === lane.id);
          return (
            <section
              key={lane.id}
              aria-label={typeof lane.head === 'string' ? lane.head : undefined}
              onDragOver={(e) => { if (drag && !blocked && !same) { e.preventDefault(); setOver(lane.id); } }}
              onDragLeave={() => setOver((o) => (o === lane.id ? null : o))}
              onDrop={(e) => { e.preventDefault(); setOver(null); if (drag && !blocked && !same) void move(drag, lane.id); setDrag(null); }}
              className={cn(
                'flex min-h-[420px] flex-col gap-2 rounded-xl border bg-subtle/40 p-2.5 transition-colors',
                over === lane.id ? 'border-primary bg-primary-soft/50' : 'border-border',
                drag && blocked && !same && 'opacity-50',
              )}
            >
              <h3 className="flex items-center gap-1.5 px-1 text-xs font-semibold">
                {lane.head}
                <span className="ml-auto font-normal tabular-nums text-muted-foreground">{lane.items.length}</span>
              </h3>
              {drag && blocked && !same && <p className="px-1 text-2xs text-muted-foreground">{blocked}</p>}
              {lane.items.map((t) => (
                <BoardCard key={t.id} t={t} me={me} dragging={drag?.id === t.id} onDragStart={() => setDrag(t)} onDragEnd={() => { setDrag(null); setOver(null); }} />
              ))}
              {!lane.items.length && !drag && <p className="px-1 py-6 text-center text-xs text-muted-foreground">Nothing here</p>}
            </section>
          );
        })}
      </div>
      {openTotal > open.length && (
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          Showing {open.length} of {openTotal} open tickets
          <Button size="sm" variant="secondary" loading={active.isFetchingNextPage} onClick={() => void active.fetchNextPage()}>Load more</Button>
        </div>
      )}
      {ask && <AskDialog t={ask.t} to={ask.to} onClose={() => setAsk(null)} />}
    </>
  );

  async function move(t: Ticket, to: string) {
    if (groupBy === 'owner') return assignTo(t, to === 'none' ? null : to);
    if (to === 'new') return assignTo(t, null);
    if (to === 'working') return assignTo(t, me ?? null);
    setAsk({ t, to: to as 'waiting' | 'resolved' });
  }
  async function assignTo(t: Ticket, id: string | null) {
    try {
      await api.post(`/helpdesk/tickets/${t.id}/assign`, { assigneeId: id });
      void qc.invalidateQueries({ queryKey: helpdeskKeys.all });
      toast.success(id ? `#${t.number} → ${id === me ? 'you' : (teamOf.get(t.queue)?.members.find((m) => m.id === id)?.firstName ?? 'assigned')}` : `#${t.number} back to New`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not move the ticket'));
    }
  }
}

/** Owner lanes: Unassigned, then each person in the teams on the board (busiest first). */
function useOwners(all: Ticket[], teamOf: Map<Queue, HelpdeskTeam>) {
  return useMemo(() => {
    const people = new Map<string, { firstName: string; lastName: string; avatarUrl: string | null; awayToday: boolean }>();
    for (const t of teamOf.values()) for (const m of t.members) if (m.inQueue && m.active) people.set(m.id, m);
    const open = (id: string) => all.filter((t) => t.assignee?.id === id && t.status !== 'RESOLVED').length;
    return [
      { id: 'none', head: <span className="flex items-center gap-1.5 text-info"><UserX className="h-3.5 w-3.5" /><span className="text-foreground">Unassigned</span></span> },
      ...[...people.entries()].sort((a, b) => open(b[0]) - open(a[0])).map(([id, p]) => ({
        id,
        head: <span className="flex items-center gap-1.5"><PersonAvatar person={p} size="xs" /> {p.firstName}{p.awayToday && <Badge className="px-1 py-0 text-2xs">away</Badge>}</span>,
      })),
    ];
  }, [all, teamOf]);
}

function BoardCard({ t, me, dragging, onDragStart, onDragEnd }: { t: Ticket; me?: string; dragging: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  const running = t.status === 'OPEN' || t.status === 'IN_PROGRESS';
  const due = running ? dueText(!t.firstRespondedAt ? t.firstResponseDueAt : t.resolutionDueAt) : null;
  return (
    <Link
      href={`/app/helpdesk/${t.id}`}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); onDragStart(); }}
      onDragEnd={onDragEnd}
      className={cn(
        'block cursor-grab space-y-2 rounded-lg border border-border bg-card p-3 text-xs shadow-sm transition-[transform,box-shadow,opacity] duration-200 hover:border-foreground/20 active:cursor-grabbing',
        dragging && 'rotate-[-2deg] scale-[1.02] opacity-60 shadow-lg',
        due?.late && 'hd-overdue',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-mono font-semibold text-muted-foreground">#{t.number}</span>
        <Badge tone={PRIORITY[t.priority].tone} className="px-1.5 py-0 text-2xs">{PRIORITY[t.priority].label}</Badge>
        <span className="ml-auto"><TargetRing t={t} size={26} /></span>
      </div>
      <p className="line-clamp-2 text-[13px] font-medium leading-snug">{t.subject}</p>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span aria-hidden>{t.queueEmoji}</span>
        <PersonAvatar person={t.employee} size="xs" />
        {t.assignee && <><span aria-hidden>→</span><PersonAvatar person={t.assignee} size="xs" />{t.assignee.id === me && <span className="text-2xs font-medium text-primary">you</span>}</>}
      </div>
      {due && <p className={cn('text-2xs', due.late ? 'font-medium text-destructive' : 'text-muted-foreground')}>{!t.firstRespondedAt ? 'Reply ' : 'Fix '}{due.text}</p>}
      {t.status === 'RESOLVED' && t.rating && <p className="text-2xs text-warning">{'★'.repeat(t.rating)}</p>}
    </Link>
  );
}

/** Dropping on "Waiting" asks the employee something; on "Resolved" says what was done. */
function AskDialog({ t, to, onClose }: { t: Ticket; to: 'waiting' | 'resolved'; onClose: () => void }) {
  const post = usePostMessage(t.id);
  const resolve = useResolveTicket(t.id);
  const busy = post.isPending || resolve.isPending;
  const [text, setText] = useState('');
  const submit = async () => {
    try {
      if (to === 'waiting') await post.mutateAsync({ body: text, waitForEmployee: true });
      else await resolve.mutateAsync(text);
      toast.success(to === 'waiting' ? `Asked ${t.employee.firstName} — the clock is paused` : `#${t.number} resolved`);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update the ticket'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={to === 'waiting' ? `What do you need from ${t.employee.firstName}?` : 'What did you do?'}
      description={`#${t.number} ${t.subject}`}
      size="sm"
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button loading={busy} disabled={text.trim().length < (to === 'waiting' ? 1 : 3)} onClick={() => void submit()}>{to === 'waiting' ? 'Ask and wait' : 'Resolve'}</Button></>}
    >
      <Textarea autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} aria-label={to === 'waiting' ? 'Question for the employee' : 'Resolution'} placeholder={to === 'waiting' ? 'e.g. Can you send a screenshot of the error?' : 'e.g. Updated the VPN app to 5.3'} />
    </Modal>
  );
}

