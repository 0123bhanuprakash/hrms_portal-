'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Inbox, ListChecks, Search, ShieldCheck, Star, Timer, UserCheck, UserX } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, EmptyState, Skeleton, Tabs } from '@/components/ui/feedback';
import { Input, inputClass } from '@/components/ui/field';
import { TicketList } from '@/components/helpdesk/ticket-list';
import { useAccess } from '@/lib/access/use-access';
import { PRIORITY, QUEUE_INFO, useHelpdeskSummary, useMyQueues, useTickets, type Priority, type Queue, type QueueSummary, type TicketQuery } from '@/lib/company/helpdesk';

type View = 'me' | 'unassigned' | 'open' | 'overdue' | 'resolved' | 'closed';
const VIEW_QUERY: Record<View, Partial<TicketQuery>> = {
  me: { status: 'active', assignee: 'me' },
  unassigned: { status: 'active', assignee: 'unassigned' },
  open: { status: 'active' },
  overdue: { overdue: 'true' },
  resolved: { status: 'RESOLVED' },
  closed: { status: 'CLOSED' },
};

export default function TicketQueuePage() {
  const { hasFeature, isLoading: accessLoading } = useAccess();
  const queues = useMyQueues();
  const allowed = hasFeature('ops.helpdesk') && queues.length > 0;
  const [view, setView] = useState<View>('open');
  const [queue, setQueue] = useState<Queue | ''>('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const summary = useHelpdeskSummary(allowed);
  const list = useTickets({ view: 'queue', ...VIEW_QUERY[view], queue: queue || undefined, priority: priority || undefined, search: debounced || undefined, page }, allowed);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" description="You don’t work a helpdesk queue." />;

  const shown = (summary.data?.queues ?? []).filter((s) => !queue || s.queue === queue);
  const total = (k: keyof QueueSummary) => shown.reduce((n, s) => n + (Number(s[k]) || 0), 0);
  const count = (v: View) => (view === v && list.data ? { count: list.data.meta.total } : {});

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Helpdesk"
        title={queues.length === 1 ? `${QUEUE_INFO[queues[0]!].label} tickets` : 'Ticket queue'}
        description="Tickets from employees, most urgent first. Reply, ask for details, or resolve — the employee can reopen within 7 days."
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

      <Tabs
        tabs={[
          { id: 'open' as const, label: 'All open', icon: <ListChecks />, ...count('open') },
          { id: 'me' as const, label: 'Assigned to me', icon: <UserCheck />, ...count('me') },
          { id: 'unassigned' as const, label: 'Unassigned', icon: <UserX />, ...count('unassigned') },
          { id: 'overdue' as const, label: 'Overdue', icon: <AlertTriangle />, ...count('overdue') },
          { id: 'resolved' as const, label: 'Resolved' },
          { id: 'closed' as const, label: 'Closed' },
        ]}
        value={view}
        onChange={(v) => { setView(v); setPage(1); }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="#number, subject or employee…" className="pl-9" aria-label="Search tickets" />
        </div>
        {queues.length > 1 && (
          <select className={`${inputClass} w-auto`} value={queue} onChange={(e) => { setQueue(e.target.value as Queue | ''); setPage(1); }} aria-label="Queue">
            <option value="">All my queues</option>
            {queues.map((q) => <option key={q} value={q}>{QUEUE_INFO[q].label}</option>)}
          </select>
        )}
        <select className={`${inputClass} w-auto`} value={priority} onChange={(e) => { setPriority(e.target.value as Priority | ''); setPage(1); }} aria-label="Priority">
          <option value="">Any priority</option>
          {(Object.keys(PRIORITY) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
        </select>
      </div>
      <TicketList
        query={list}
        agentView
        empty={view === 'me' ? 'Nothing assigned to you' : view === 'unassigned' ? 'Every ticket has an owner' : view === 'overdue' ? 'Nothing overdue' : 'No tickets here'}
        page={page}
        onPage={setPage}
      />
    </div>
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
