'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, Bookmark, Columns3, Crown, Inbox, Keyboard, List, ListChecks, Palmtree, Search, ShieldCheck, Sparkles, Star, Timer, UserCheck, UserX, Users, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Pagination, Skeleton, Tabs } from '@/components/ui/feedback';
import { Input, inputClass } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { QueuePreview, PREVIEW_REPLY_ID } from '@/components/helpdesk/queue-preview';
import { QueueBoard } from '@/components/helpdesk/queue-board';
import { targetUse } from '@/components/helpdesk/ticket-visuals';
import { useAccess } from '@/lib/access/use-access';
import { useUiState } from '@/lib/preferences/ui-state';
import {
  PRIORITY,
  STATUS,
  suggestAssignee,
  useAssignTicket,
  useBulkTickets,
  useHelpdeskSummary,
  useHelpdeskTeams,
  useHelpdeskQueues,
  useTickets,
  type HelpdeskTeam,
  type Priority,
  type Queue,
  type QueueSummary,
  type Ticket,
  type TicketQuery,
} from '@/lib/company/helpdesk';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/pickers';

type View = 'me' | 'unassigned' | 'open' | 'overdue' | 'resolved' | 'closed';
const VIEWS: View[] = ['me', 'unassigned', 'open', 'overdue', 'resolved', 'closed'];
const VIEW_QUERY: Record<View, Partial<TicketQuery>> = {
  me: { status: 'active', assignee: 'me' },
  unassigned: { status: 'active', assignee: 'unassigned' },
  open: { status: 'active' },
  overdue: { overdue: 'true' },
  resolved: { status: 'RESOLVED' },
  closed: { status: 'CLOSED' },
};

/** A private saved filter (follows the person to any device). */
interface SavedView {
  id: string;
  name: string;
  view: View;
  queue: Queue | '';
  priority: Priority | '';
  search: string;
}
const isViews = (v: unknown): v is SavedView[] => Array.isArray(v) && v.every((x) => x && typeof x === 'object' && typeof (x as SavedView).name === 'string' && VIEWS.includes((x as SavedView).view));

export default function TicketQueuePage() {
  const router = useRouter();
  const { hasFeature, isLoading: accessLoading } = useAccess();
  const hq = useHelpdeskQueues();
  const queues = hq.mine;
  const allowed = hasFeature('ops.helpdesk') && queues.length > 0;
  const [view, setView] = useState<View>('open');
  const [queue, setQueue] = useState<Queue | ''>('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState(0);
  const [peek, setPeek] = useState<string | null>(null);
  const [saved, setSaved] = useUiState<SavedView[]>('helpdesk:queue-views', [], isViews);
  const [naming, setNaming] = useState<string | null>(null);
  const [layout, setLayout] = useUiState<'list' | 'board'>('helpdesk:queue-layout', 'list', (v): v is 'list' | 'board' => v === 'list' || v === 'board');
  const [groupBy, setGroupBy] = useState<'status' | 'owner'>('status');
  const board = layout === 'board';
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const summary = useHelpdeskSummary(allowed);
  const teams = useHelpdeskTeams(allowed);
  const list = useTickets({ view: 'queue', ...VIEW_QUERY[view], queue: queue || undefined, priority: priority || undefined, search: debounced || undefined, page }, allowed && !board);
  const rows = useMemo(() => list.data?.data ?? [], [list.data]);
  const teamOf = useMemo(() => new Map((teams.data?.teams ?? []).map((t) => [t.queue, t])), [teams.data]);
  const leadsHeaded = (teams.data?.teams ?? []).some((t) => t.isLead && t.headId);
  const ledTeams = (teams.data?.teams ?? []).filter((t) => t.isLead && t.headId && queues.includes(t.queue));

  // Selection and focus follow the list
  useEffect(() => {
    setSelected((s) => new Set([...s].filter((id) => rows.some((r) => r.id === id))));
    setFocus((f) => Math.min(f, Math.max(0, rows.length - 1)));
  }, [rows]);

  // ── Keyboard: J/K move, Enter open, X select, A assign, R reply, / search ──
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (board) return;
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)))) return;
      const row = rows[focus];
      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        const next = Math.max(0, Math.min(rows.length - 1, focus + (e.key === 'j' ? 1 : -1)));
        setFocus(next);
        setPeek(rows[next]?.id ?? null);
        document.getElementById(`qrow-${rows[next]?.id}`)?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && row) router.push(`/app/helpdesk/${row.id}`);
      else if (e.key === 'x' && row) setSelected((s) => toggle(s, row.id));
      else if (e.key === 'a' && row) document.getElementById(`qa-${row.id}`)?.focus();
      else if (e.key === 'r' && row) { setPeek(row.id); setTimeout(() => document.getElementById(PREVIEW_REPLY_ID)?.focus(), 80); }
      else if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else return;
    },
    [rows, focus, router, board],
  );
  useEffect(() => {
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onKey]);

  if (!accessLoading && !hq.loading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" description="You don’t work a helpdesk team." />;

  const shown = (summary.data?.queues ?? []).filter((s) => !queue || s.queue === queue);
  const total = (k: keyof QueueSummary) => shown.reduce((n, s) => n + (Number(s[k]) || 0), 0);
  const count = (v: View) => (view === v && list.data ? { count: list.data.meta.total } : {});
  const apply = (v: SavedView) => { setView(v.view); setQueue(v.queue); setPriority(v.priority); setSearch(v.search); setPage(1); };
  const isActive = (v: SavedView) => v.view === view && v.queue === queue && v.priority === priority && v.search === search.trim();
  const saveView = (name: string) => {
    if (!name.trim()) return setNaming(null);
    setSaved([...saved.filter((v) => v.name !== name.trim()), { id: crypto.randomUUID().slice(0, 8), name: name.trim().slice(0, 30), view, queue, priority, search: search.trim().slice(0, 60) }].slice(-8));
    setNaming(null);
    toast.success('View saved — only you see it');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Helpdesk"
        title={queues.length === 1 ? `${hq.info(queues[0]!).label} tickets` : 'Ticket queue'}
        description="Tickets from employees, most urgent first. New ones appear live. Click a row to peek; keyboard shortcuts are listed on the right."
        action={
          <div className="flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Layout">
            {([['list', <List key="l" />, 'List'], ['board', <Columns3 key="b" />, 'Board']] as const).map(([id, ic, label]) => (
              <button key={id} type="button" role="radio" aria-checked={layout === id} onClick={() => setLayout(id)} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm [&_svg]:h-4 [&_svg]:w-4', layout === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>{ic}{label}</button>
            ))}
          </div>
        }
      />

      {summary.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={<Inbox />} label="Open" value={total('active')} sub={`${total('unassigned')} unassigned · ${total('waiting')} waiting on employee`} />
          <Stat icon={<AlertTriangle />} label="Overdue" value={total('overdue')} sub="Past a response or resolution target" danger={total('overdue') > 0} />
          <Stat icon={<Timer />} label="On time (30 days)" value={pct(shown, 'responseOnTimePct', 'created')} sub={`Resolved on time: ${pct(shown, 'resolutionOnTimePct', 'resolved')}`} />
          <Stat icon={<Star />} label="Rating (30 days)" value={rating(shown)} sub={`${total('resolved')} resolved · ${total('ratings')} rated`} />
        </div>
      )}

      {!board && <Tabs
        tabs={[
          { id: 'open' as const, label: 'All open', icon: <ListChecks />, ...count('open') },
          { id: 'me' as const, label: 'Assigned to me', icon: <UserCheck />, ...count('me') },
          { id: 'unassigned' as const, label: leadsHeaded ? 'To assign' : 'Unassigned', icon: leadsHeaded ? <Crown /> : <UserX />, ...count('unassigned') },
          { id: 'overdue' as const, label: 'Overdue', icon: <AlertTriangle />, ...count('overdue') },
          { id: 'resolved' as const, label: 'Resolved' },
          { id: 'closed' as const, label: 'Closed' },
        ]}
        value={view}
        onChange={(v) => { setView(v); setPage(1); }}
      />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="#number, subject or employee…  ( / )" className="pl-9" aria-label="Search tickets" />
        </div>
        {queues.length > 1 && (
          <Select className={`${inputClass} w-auto`} value={queue} onChange={(e) => { setQueue(e.target.value as Queue | ''); setPage(1); }} aria-label="Team">
            <option value="">All my teams</option>
            {queues.map((q) => <option key={q} value={q}>{hq.info(q).emoji} {hq.info(q).label}{hq.info(q).archived ? ' (archived)' : ''}</option>)}
          </Select>
        )}
        <Select className={`${inputClass} w-auto`} value={priority} onChange={(e) => { setPriority(e.target.value as Priority | ''); setPage(1); }} aria-label="Priority">
          <option value="">Any priority</option>
          {(Object.keys(PRIORITY) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
        </Select>
        {board && (
          <div className="flex rounded-lg border border-border p-0.5 text-sm" role="radiogroup" aria-label="Group by">
            {([['status', 'By status'], ['owner', 'By owner']] as const).map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={groupBy === id} onClick={() => setGroupBy(id)} className={cn('rounded-md px-3 py-1', groupBy === id ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')}>{label}</button>
            ))}
          </div>
        )}
        {!board && (naming === null ? (
          <Button variant="secondary" onClick={() => setNaming('')} title="Save these filters as a view only you see"><Bookmark /> Save view</Button>
        ) : (
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); saveView(naming); }}>
            <Input autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} placeholder="Name, e.g. VPN this week" maxLength={30} className="w-44" aria-label="View name" onKeyDown={(e) => e.key === 'Escape' && setNaming(null)} />
            <Button type="submit" size="sm" className="h-9">Save</Button>
          </form>
        ))}
      </div>
      {!board && saved.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">My views:</span>
          {saved.map((v) => (
            <span key={v.id} className={cn('inline-flex items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-xs', isActive(v) ? 'border-primary bg-primary-soft text-primary' : 'border-border hover:bg-subtle')}>
              <button type="button" onClick={() => apply(v)} className="font-medium">★ {v.name}</button>
              <button type="button" aria-label={`Remove view ${v.name}`} onClick={() => setSaved(saved.filter((x) => x.id !== v.id))} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}

      {board && (
        <>
          <QueueBoard filters={{ queue: queue || undefined, priority: priority || undefined, search: debounced || undefined }} teamOf={teamOf} groupBy={groupBy} />
          <p className="text-xs text-muted-foreground">Drag a card: New → Working assigns it to you · Waiting asks the employee something · Resolved asks what you did · back to New unassigns. By owner: drop on a person to assign (team heads).</p>
        </>
      )}

      {!board && selected.size > 0 && <BulkBar ids={[...selected]} rows={rows} teamOf={teamOf} queues={queues} onDone={() => setSelected(new Set())} />}

      {!board && <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {list.isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : list.isError ? (
            <ErrorState message={getApiErrorMessage(list.error, 'Could not load tickets')} onRetry={() => void list.refetch()} />
          ) : !rows.length ? (
            <EmptyState icon={<span className="text-4xl motion-safe:animate-[a3-float_8s_ease-in-out_infinite]" aria-hidden>🌤️</span>} title={view === 'me' ? 'Nothing assigned to you' : view === 'unassigned' ? 'Every ticket has an owner' : view === 'overdue' ? 'Nothing overdue' : 'Nothing waiting. Nice work, team.'} />
          ) : (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border bg-subtle/50 px-3 py-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                <input type="checkbox" aria-label="Select all on this page" className="accent-[hsl(var(--primary))]" checked={selected.size > 0 && rows.every((r) => selected.has(r.id))} onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} />
                <span className="flex-1">Ticket</span>
                <span className="hidden w-36 md:block">Owner</span>
                <span className="hidden w-40 sm:block">Target</span>
              </div>
              <ul className="divide-y divide-border">
                {rows.map((t, i) => (
                  <QueueRow
                    key={t.id}
                    t={t}
                    team={teamOf.get(t.queue)}
                    focused={i === focus}
                    peeking={peek === t.id}
                    checked={selected.has(t.id)}
                    onCheck={() => setSelected((s) => toggle(s, t.id))}
                    onPeek={() => { setFocus(i); setPeek(t.id); }}
                    onOpen={() => router.push(`/app/helpdesk/${t.id}`)}
                  />
                ))}
              </ul>
            </Card>
          )}
          {list.data && <Pagination page={page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <QueuePreview id={peek} />
          {ledTeams.map((t) => <TeamLoad key={t.queue} team={t} />)}
          <KeyboardHelp />
        </aside>
      </div>}
    </div>
  );
}

const toggle = (s: Set<string>, id: string) => {
  const n = new Set(s);
  if (n.has(id)) n.delete(id);
  else n.add(id);
  return n;
};

/** "Reply due in 40m", "Late by 20m", "Waiting on employee"… with a bar of the time used. */
function TargetBar({ t }: { t: Ticket }) {
  if (t.status === 'WAITING') return <span className="text-xs font-medium text-primary">⏸ Waiting on employee</span>;
  if (t.status === 'RESOLVED' || t.status === 'CLOSED') return <span className="text-xs text-muted-foreground">{STATUS[t.status].label}</span>;
  const { used } = targetUse(t);
  const due = new Date(t.firstRespondedAt ? t.resolutionDueAt : t.firstResponseDueAt).getTime();
  const ms = due - Date.now();
  const span = (n: number) => (n < 3600_000 ? `${Math.max(1, Math.round(n / 60_000))}m` : n < 48 * 3600_000 ? `${Math.round(n / 3600_000)}h` : `${Math.round(n / 86400_000)}d`);
  const text = ms < 0 ? `Late by ${span(-ms)}` : `${t.firstRespondedAt ? 'Fix' : 'Reply'} due in ${span(ms)}`;
  const tone = used >= 1 ? 'bg-destructive' : used > 0.75 ? 'bg-warning' : 'bg-success';
  return (
    <div className="space-y-1">
      <span className="block h-1.5 overflow-hidden rounded-full bg-muted"><span className={cn('m-fill-w block h-full rounded-full', tone)} style={{ width: `${Math.min(100, used * 100)}%` }} /></span>
      <span className={cn('text-xs', used >= 1 ? 'font-medium text-destructive' : used > 0.75 ? 'font-medium text-warning' : 'text-muted-foreground')}>{text}</span>
    </div>
  );
}

function QueueRow({ t, team, focused, peeking, checked, onCheck, onPeek, onOpen }: { t: Ticket; team?: HelpdeskTeam; focused: boolean; peeking: boolean; checked: boolean; onCheck: () => void; onPeek: () => void; onOpen: () => void }) {
  const late = (t.status === 'OPEN' || t.status === 'IN_PROGRESS') && (t.responseOverdue || t.resolutionOverdue);
  return (
    <li
      id={`qrow-${t.id}`}
      onClick={onPeek}
      onDoubleClick={onOpen}
      className={cn('flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-subtle/60', peeking && 'bg-primary-soft/40 shadow-[inset_3px_0_0_hsl(var(--primary))]', focused && !peeking && 'shadow-[inset_3px_0_0_hsl(var(--border))]', late && 'hd-overdue')}
    >
      <input type="checkbox" checked={checked} onChange={onCheck} onClick={(e) => e.stopPropagation()} aria-label={`Select #${t.number}`} className="accent-[hsl(var(--primary))]" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
          <span className="font-mono font-semibold">#{t.number}</span>
          <Badge tone={PRIORITY[t.priority].tone} className="px-1.5 py-0 text-2xs">{PRIORITY[t.priority].label}</Badge>
          <span>{t.queueEmoji} {t.queueLabel}{t.category ? ` · ${t.category.icon ?? ''} ${t.category.name}` : ''}</span>
        </p>
        <p className="truncate text-sm font-medium">{t.subject}</p>
        <p className="flex items-center gap-1.5 truncate text-2xs text-muted-foreground"><PersonAvatar person={t.employee} size="xs" /> {t.employee.firstName} {t.employee.lastName}</p>
      </div>
      <div className="hidden w-36 md:block" onClick={(e) => e.stopPropagation()}>
        <Owner t={t} team={team} />
      </div>
      <div className="hidden w-40 sm:block"><TargetBar t={t} /></div>
    </li>
  );
}

/** Owner cell: the person, or — for the team head — a quick assign picker with a suggestion. */
function Owner({ t, team }: { t: Ticket; team?: HelpdeskTeam }) {
  const assign = useAssignTicket(t.id);
  if (t.assignee && !t.canAssign) return <span className="flex items-center gap-1.5 text-xs"><PersonAvatar person={t.assignee} size="xs" /> {t.assignee.firstName}</span>;
  if (!t.canAssign) return <span className="text-xs text-muted-foreground">Unassigned</span>;
  const people = (team?.members ?? []).filter((m) => m.inQueue && m.active && m.id !== t.requesterUserId);
  const best = !t.assignee ? suggestAssignee(team, t.requesterUserId) : null;
  const run = async (id: string) => {
    try {
      await assign.mutateAsync(id || null);
      const m = people.find((p) => p.id === id);
      toast.success(id ? `#${t.number} → ${m?.firstName ?? 'assigned'}` : `#${t.number} unassigned`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not assign'));
    }
  };
  if (!people.length && !t.assignee) return <span className="text-xs text-muted-foreground">Unassigned</span>;
  return (
    <div className="space-y-1">
      <Select id={`qa-${t.id}`} aria-label={`Assign #${t.number}`} className={cn(inputClass, 'h-8 py-0 text-xs')} value={t.assignee?.id ?? ''} disabled={assign.isPending} onChange={(e) => void run(e.target.value)}>
        <option value="">{t.assignee ? 'Unassign' : 'Assign to…'}</option>
        {t.assignee && !people.some((p) => p.id === t.assignee!.id) && <option value={t.assignee.id}>{t.assignee.firstName} {t.assignee.lastName}</option>}
        {people.map((m) => <option key={m.id} value={m.id}>{m.firstName} — {m.open} open{m.awayToday ? ' · away' : ''}</option>)}
      </Select>
      {best && (
        <button type="button" onClick={() => void run(best.id)} className="flex items-center gap-1 text-2xs font-medium text-primary hover:underline" disabled={assign.isPending}>
          <Sparkles className="h-3 w-3" /> {best.firstName} ({best.open} open)
        </button>
      )}
    </div>
  );
}

function BulkBar({ ids, rows, teamOf, queues, onDone }: { ids: string[]; rows: Ticket[]; teamOf: Map<Queue, HelpdeskTeam>; queues: Queue[]; onDone: () => void }) {
  const bulk = useBulkTickets();
  const hq = useHelpdeskQueues();
  const picked = rows.filter((r) => ids.includes(r.id));
  const oneTeam = new Set(picked.map((r) => r.queue)).size === 1 ? picked[0]?.queue : undefined;
  const people = oneTeam ? (teamOf.get(oneTeam)?.members ?? []).filter((m) => m.inQueue && m.active) : [];
  const canAssign = picked.every((r) => r.canAssign);
  const run = async (body: Parameters<typeof bulk.mutateAsync>[0], what: string) => {
    try {
      const r = await bulk.mutateAsync(body);
      if (r.failed.length) toast.warning(`${what}: ${r.done} done, ${r.failed.length} not — ${r.failed.map((f) => `#${f.number}: ${f.message}`).join('; ')}`);
      else toast.success(`${what}: ${r.done} ticket${r.done === 1 ? '' : 's'}`);
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update'));
    }
  };
  return (
    <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft/80 px-3 py-2 text-sm shadow-sm backdrop-blur animate-fade-up">
      <b className="text-primary">{ids.length} selected</b>
      {canAssign && oneTeam && people.length > 0 && (
        <Select aria-label="Assign selected to" className={cn(inputClass, 'h-8 w-auto py-0 text-xs')} value="" disabled={bulk.isPending} onChange={(e) => e.target.value && void run({ ids, action: 'assign', assigneeId: e.target.value === '-' ? null : e.target.value }, 'Assigned')}>
          <option value="">Assign to…</option>
          {people.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName} — {m.open} open{m.awayToday ? ' · away' : ''}</option>)}
          <option value="-">Unassign</option>
        </Select>
      )}
      {canAssign && !oneTeam && <span className="text-xs text-muted-foreground">Pick tickets of one team to assign together</span>}
      <Select aria-label="Set priority of selected" className={cn(inputClass, 'h-8 w-auto py-0 text-xs')} value="" disabled={bulk.isPending} onChange={(e) => e.target.value && void run({ ids, action: 'priority', priority: e.target.value as Priority }, 'Priority changed')}>
        <option value="">Priority…</option>
        {(Object.keys(PRIORITY) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
      </Select>
      <Select aria-label="Move selected to another team" className={cn(inputClass, 'h-8 w-auto py-0 text-xs')} value="" disabled={bulk.isPending} onChange={(e) => e.target.value && void run({ ids, action: 'move', queue: e.target.value as Queue }, 'Moved')}>
        <option value="">Move to team…</option>
        {hq.open.map((q) => <option key={q.queue} value={q.queue}>{q.emoji} {q.label}{queues.includes(q.queue) ? '' : ' (leaves your queue)'}</option>)}
      </Select>
      <Button size="sm" variant="ghost" className="ml-auto h-8" onClick={onDone}><X /> Clear</Button>
    </div>
  );
}

/** Team head: who has how much, who is away today. Helps to share work fairly — not a score. */
function TeamLoad({ team }: { team: HelpdeskTeam }) {
  const people = team.members.filter((m) => m.inQueue && m.active).sort((a, b) => b.open - a.open);
  const max = Math.max(4, ...people.map((m) => m.open));
  return (
    <Card className="space-y-2.5 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><Users className="h-4 w-4" /> {team.label} team load <span className="ml-auto text-2xs font-normal text-muted-foreground">you lead it</span></p>
      {people.map((m) => (
        <div key={m.id} className="flex items-center gap-2 text-xs">
          <PersonAvatar person={m} size="xs" />
          <span className="w-16 truncate font-medium">{m.firstName}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className={cn('m-fill-w block h-full rounded-full', m.open / max > 0.8 ? 'bg-warning' : 'bg-success')} style={{ width: `${(m.open / max) * 100}%` }} /></span>
          <span className="w-12 text-right tabular-nums text-muted-foreground">{m.open} open</span>
          {m.awayToday && <Palmtree className="h-3.5 w-3.5 text-muted-foreground" aria-label="On leave today" />}
        </div>
      ))}
      <p className="text-2xs text-muted-foreground">{team.unassigned} to assign · only you and the backup see this.</p>
    </Card>
  );
}

function KeyboardHelp() {
  const keys: Array<[string, string]> = [['J / K', 'next / previous'], ['Enter', 'open'], ['X', 'select'], ['A', 'assign (heads)'], ['R', 'reply in preview'], ['/', 'search']];
  return (
    <Card className="space-y-1.5 bg-subtle/40 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><Keyboard className="h-4 w-4" /> Keyboard</p>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-xs">
        {keys.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt><kbd className="rounded border border-b-2 border-border bg-background px-1.5 font-mono text-2xs">{k}</kbd></dt>
            <dd className="text-muted-foreground">{v}</dd>
          </React.Fragment>
        ))}
      </dl>
    </Card>
  );
}

function pct(rows: QueueSummary[], key: 'responseOnTimePct' | 'resolutionOnTimePct', weight: 'created' | 'resolved') {
  const known = rows.filter((r) => r[key] !== null);
  if (!known.length) return '—';
  const w = known.reduce((n, r) => n + Math.max(1, r[weight]), 0);
  return `${Math.round(known.reduce((n, r) => n + r[key]! * Math.max(1, r[weight]), 0) / w)}%`;
}

function rating(rows: QueueSummary[]) {
  const rated = rows.filter((r) => r.avgRating !== null);
  const n = rated.reduce((s, r) => s + r.ratings, 0);
  return n ? `${(rated.reduce((s, r) => s + r.avgRating! * r.ratings, 0) / n).toFixed(1)} ★` : '—';
}

function Stat({ icon, label, value, sub, danger }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: string; danger?: boolean }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">{icon}{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${danger ? 'text-destructive' : ''}`}>{value}</p>
      <p className="mt-0.5 truncate text-2xs text-muted-foreground">{sub}</p>
    </Card>
  );
}
