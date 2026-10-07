'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, ChartNoAxesColumn, GripVertical, Pencil, Plus, Route, ShieldCheck, Tags, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { TeamsPanel } from '@/components/helpdesk/teams-panel';
import { TopicEditor } from '@/components/helpdesk/topic-editor';
import { useAccess } from '@/lib/access/use-access';
import { PRIORITY, QUEUE_INFO, useMyQueues, useReorderTopics, useTicketCategories, type Queue, type TicketCategory } from '@/lib/company/helpdesk';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

const TEAM_EMOJI: Record<Queue, string> = { IT: '💻', HR: '🧑‍💼', FINANCE: '💰', DEVOPS: '🚀' };

export default function TicketCategoriesPage() {
  const { hasFeature, can, isLoading: accessLoading } = useAccess();
  const queues = useMyQueues();
  const allowed = hasFeature('ops.helpdesk') && (queues.length > 0 || can('ticket.manage_teams'));
  const cats = useTicketCategories(true, allowed && queues.length > 0);
  const [editing, setEditing] = useState<TicketCategory | Queue | null>(null);
  const [picked, setTab] = useState<'topics' | 'teams'>('topics');
  // Company Admins without a queue of their own only manage heads
  const tab = queues.length ? picked : 'teams';
  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Helpdesk" title="Ticket topics" description="The topics employees pick when they raise a ticket, and who leads each team. Each team manages its own topics." />
      <Tabs
        tabs={[
          ...(queues.length ? [{ id: 'topics' as const, label: 'Topics', icon: <Tags /> }] : []),
          { id: 'teams' as const, label: 'Teams & heads', icon: <Users /> },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'teams' ? (
        <TeamsPanel />
      ) : cats.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : cats.isLoadingError ? (
        <ErrorState message={getApiErrorMessage(cats.error, 'Could not load the topics')} onRetry={() => void cats.refetch()} />
      ) : (
        <>
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {queues.map((q) => (
              <TeamTopics key={q} queue={q} topics={(cats.data ?? []).filter((c) => c.queue === q)} onEdit={setEditing} />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tip icon={<GripVertical />} title="Drag to reorder">The order here is the order employees see.</Tip>
            <Tip icon={<Route />} title="Routing">New tickets go to the team head, or straight to one person.</Tip>
            <Tip icon={<BookOpen />} title="Quick answer">Shown while the employee types — many problems never need a ticket.</Tip>
            <Tip icon={<ChartNoAxesColumn />} title="Use count">See which topics are busy; hide the ones nobody uses.</Tip>
          </div>
        </>
      )}
      <TopicEditor value={editing} queues={queues} onClose={() => setEditing(null)} />
    </div>
  );
}

function TeamTopics({ queue, topics, onEdit }: { queue: Queue; topics: TicketCategory[]; onEdit: (t: TicketCategory | Queue) => void }) {
  const reorder = useReorderTopics();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const busiest = Math.max(1, ...topics.map((t) => t.used30 ?? 0));

  const drop = (targetId: string) => {
    if (!drag || drag === targetId) return;
    const ids = topics.map((t) => t.id).filter((id) => id !== drag);
    ids.splice(ids.indexOf(targetId) + (topics.findIndex((t) => t.id === drag) < topics.findIndex((t) => t.id === targetId) ? 1 : 0), 0, drag);
    reorder.mutate({ queue, ids }, { onError: (err) => toast.error(getApiErrorMessage(err, 'Could not reorder')) });
  };
  /** Keyboard: Alt + ↑ / ↓ moves a topic */
  const nudge = (id: string, by: number) => {
    const ids = topics.map((t) => t.id);
    const i = ids.indexOf(id);
    const j = i + by;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder.mutate({ queue, ids });
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-subtle/40 px-5 py-3">
        <span className="text-lg" aria-hidden>{TEAM_EMOJI[queue]}</span>
        <h2 className="text-sm font-semibold">{QUEUE_INFO[queue].label}</h2>
        <span className="text-xs text-muted-foreground">{topics.filter((t) => t.isActive).length} topics</span>
        <Button size="sm" variant="secondary" className="ml-auto" onClick={() => onEdit(queue)}><Plus /> Add</Button>
      </div>
      <ul className="divide-y divide-border">
        {topics.map((t) => (
          <li
            key={t.id}
            draggable
            onDragStart={(e) => { setDrag(t.id); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { e.preventDefault(); setOver(t.id); }}
            onDragLeave={() => setOver((o) => (o === t.id ? null : o))}
            onDrop={(e) => { e.preventDefault(); drop(t.id); setDrag(null); setOver(null); }}
            onDragEnd={() => { setDrag(null); setOver(null); }}
            className={cn(
              'group flex items-center gap-3 px-4 py-2.5 transition-colors',
              !t.isActive && 'opacity-55',
              drag === t.id && 'opacity-40',
              over === t.id && drag !== t.id && 'bg-primary-soft/60',
            )}
          >
            <button
              type="button"
              className="cursor-grab rounded p-0.5 text-muted-foreground/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
              aria-label={`Move ${t.name} (Alt + arrow keys)`}
              onKeyDown={(e) => { if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); nudge(t.id, e.key === 'ArrowUp' ? -1 : 1); } }}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-base" aria-hidden>{t.icon || '🏷️'}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
                {t.defaultPriority && <Badge tone={PRIORITY[t.defaultPriority].tone} className="px-1.5 py-0 text-2xs">{PRIORITY[t.defaultPriority].label}</Badge>}
                <span>→ {t.routeTo ? t.routeTo.firstName : 'team'}</span>
                {t.questions.length > 0 && <span>· {t.questions.length} question{t.questions.length === 1 ? '' : 's'}</span>}
                {t.quickAnswer && <span className="inline-flex items-center gap-0.5 text-success"><BookOpen className="h-3 w-3" /> answer{t.helpedCount ? ` · helped ${t.helpedCount}` : ''}</span>}
                {!t.isActive && <Badge className="px-1.5 py-0 text-2xs">Hidden</Badge>}
              </p>
            </div>
            <div className="hidden w-20 shrink-0 flex-col items-end gap-1 sm:flex" title="Tickets in the last 30 days">
              <span className="text-2xs tabular-nums text-muted-foreground">{t.used30 ?? 0} / 30d</span>
              <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-primary/70" style={{ width: `${((t.used30 ?? 0) / busiest) * 100}%` }} />
              </span>
            </div>
            <Button size="icon-sm" variant="ghost" aria-label={`Edit ${t.name}`} onClick={() => onEdit(t)}><Pencil /></Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Tip({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-subtle/40 p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
