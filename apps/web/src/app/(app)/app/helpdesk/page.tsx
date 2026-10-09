'use client';

import { NoProfile } from '@/components/profile/no-profile';
import { Emoji } from '@/components/motion/emoji';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, CheckCircle2, LifeBuoy, Plus, Search, ShieldCheck, Star, ThumbsUp, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Pagination, Skeleton, Tabs } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { Journey, TargetRing, replyTime } from '@/components/helpdesk/ticket-visuals';
import { useAccess } from '@/lib/access/use-access';
import { useMyCard } from '@/lib/company/profile';
import {
  PRIORITY,
  dueText,
  useHelpdeskDirectory,
  useHelpdeskQueues,
  useQuickAnswers,
  useTicketCategories,
  useTickets,
  useTopicHelped,
  type Ticket,
  type TicketStatus,
} from '@/lib/company/helpdesk';
import { useAuthStore } from '@/store/useAuthStore';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

export default function MyTicketsPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const me = useMyCard();
  const allowed = hasFeature('ops.helpdesk') && can('ticket.view');
  const [status, setStatus] = useState<TicketStatus | 'active' | ''>('active');
  const [page, setPage] = useState(1);
  const list = useTickets({ view: 'mine', status: status || undefined, page }, allowed);
  const waiting = useTickets({ view: 'mine', status: 'WAITING', limit: 1 }, allowed);
  const solved = useTickets({ view: 'mine', status: 'RESOLVED', limit: 3 }, allowed);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="Helpdesk isn’t available" />;
  if (me.isSuccess && !me.data?.employee) return <NoProfile what="Tickets are raised by employees." />;
  const canCreate = can('ticket.create');

  return (
    <div className="space-y-6">
      {canCreate ? <AskHero /> : (
        <div>
          <p className="text-sm font-medium text-primary">Helpdesk</p>
          <h1 className="text-2xl font-semibold tracking-tight">My tickets</h1>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: 'active' as const, label: 'Open' },
            { id: 'WAITING' as const, label: 'Needs my reply', ...(waiting.data?.meta.total ? { count: waiting.data.meta.total } : {}) },
            { id: 'RESOLVED' as const, label: 'Resolved' },
            { id: 'CLOSED' as const, label: 'Closed' },
            { id: '' as const, label: 'All' },
          ]}
          value={status}
          onChange={(s) => { setStatus(s); setPage(1); }}
        />
        {canCreate && <Button asChild><Link href="/app/helpdesk/new"><Plus /> Raise a ticket</Link></Button>}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {list.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[132px] w-full" />)
          ) : list.isError ? (
            <ErrorState message={getApiErrorMessage(list.error, 'Could not load tickets')} onRetry={() => void list.refetch()} />
          ) : !list.data?.data.length ? (
            <EmptyState icon={<LifeBuoy />} title={status === 'active' ? 'No open tickets' : 'Nothing here'} description={status === 'active' && canCreate ? 'Stuck with something? Ask above, or raise a ticket and the right team will pick it up.' : undefined} />
          ) : (
            <>
              <div className="m-stagger space-y-3">{list.data.data.map((t) => <TicketCard key={t.id} t={t} />)}</div>
              <Pagination page={page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />
              <p className="text-xs text-muted-foreground">The ring shows how much of the reply / solve time is used — green, amber at 75%, red when late. It pauses while the team waits for your reply.</p>
            </>
          )}
        </div>

        <aside className="space-y-4">
          {Boolean(solved.data?.data.length) && (
            <Card className="space-y-3 p-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-success" /> Solved — fixed?</h2>
              {solved.data!.data.map((t) => (
                <Link key={t.id} href={`/app/helpdesk/${t.id}`} className="flex items-start gap-2 rounded-md p-1.5 text-sm hover:bg-subtle">
                  <span aria-hidden>{t.queueEmoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">#{t.number} {t.subject}</span>
                    <span className="text-xs text-muted-foreground">{t.assignee ? `${t.assignee.firstName} solved it` : 'Solved'} {t.resolvedAt && formatRelative(t.resolvedAt)}</span>
                  </span>
                  <Badge tone="success" className="shrink-0 gap-1"><Star className="h-3 w-3" /> Rate</Badge>
                </Link>
              ))}
            </Card>
          )}
          <Card className="space-y-2 bg-subtle/40 p-4 text-xs text-muted-foreground">
            <p className="text-sm font-semibold text-foreground">Good to know</p>
            <p>• Reply when the team asks — the clock pauses while it waits for you.</p>
            <p>• A resolved ticket closes on its own after 7 days. Not fixed? Reopen it.</p>
            <p>• A problem with your laptop or phone? Use <Link href="/app/assets/mine" className="font-medium text-primary hover:underline">My assets → Problem</Link> — it links the device.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/** "Hi Amit, how can we help?" — popular topics, quick answers while typing, and the teams to ask. */
function AskHero() {
  const firstName = useAuthStore((s) => s.user?.firstName);
  const directory = useHelpdeskDirectory();
  const topics = useTicketCategories(false);
  const queues = useHelpdeskQueues();
  // Popular topics: the first two of each team (their order is set by the team), never "Other"
  const popular = queues.open.map((x) => x.queue).flatMap((qq) => (topics.data ?? []).filter((c) => c.queue === qq && c.name !== 'Other').slice(0, 2));
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text), 300);
    return () => clearTimeout(t);
  }, [text]);
  const answers = useQuickAnswers(q);
  const helped = useTopicHelped();
  const [thanked, setThanked] = useState<string | null>(null);
  const hits = q.trim().length >= 3 ? answers.data : undefined;
  const raiseHref = (queue?: string, topic?: string) => {
    const p = new URLSearchParams();
    if (queue) p.set('queue', queue);
    if (topic) p.set('topic', topic);
    if (text.trim().length >= 5) p.set('subject', text.trim().slice(0, 150));
    const s = p.toString();
    return `/app/helpdesk/new${s ? `?${s}` : ''}`;
  };

  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary-soft via-background to-accent/10 p-5 sm:p-6">
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-16 -z-10 h-56 w-56 rounded-full bg-primary/15 blur-3xl motion-safe:animate-[pulse_9s_ease-in-out_infinite]" />
      <p className="text-sm font-medium text-primary">Helpdesk</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">Hi{firstName ? ` ${firstName}` : ''}, how can we help?</h1>
      <p className="mt-1 text-sm text-muted-foreground">Ask IT, HR, Finance or DevOps. Type your question — we show quick answers first, then you can raise a ticket.</p>

      <div className="mt-4 space-y-3">
        <div className="space-y-2">
          <label className="relative block">
            <span className="sr-only">Describe your problem</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. my payslip is missing, VPN keeps dropping…"
              className="h-12 w-full rounded-xl border border-border bg-background pl-12 pr-4 text-[15px] shadow-sm outline-none transition-shadow focus:border-primary focus:ring-4 focus:ring-primary/15"
              maxLength={150}
            />
          </label>
          {!hits && popular.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="mr-1 text-xs text-muted-foreground">Popular:</span>
              {popular.map((c) => (
                <Link key={c.id} href={raiseHref(c.queue, c.id)} className="emo-host m-lift inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium hover:border-primary/40 hover:text-primary">
                  <Emoji e={c.icon ?? '🏷️'} /> {c.name}
                </Link>
              ))}
            </div>
          )}
          {hits && (
            <div className="space-y-2 animate-fade-up" aria-live="polite">
              {hits.topics.map((t) => (
                <div key={t.id} className="rounded-xl border border-border bg-background p-3 text-sm">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><BookOpen className="h-3.5 w-3.5" /> Quick answer · {queues.info(t.queue).label} · {t.icon} {t.name}</p>
                  <p className="mt-1 whitespace-pre-wrap">{t.quickAnswer}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {thanked === t.id ? (
                      <span className="text-xs font-medium text-success">Great — glad that sorted it <Emoji e="🎉" play="appear" /></span>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => { setThanked(t.id); helped.mutate(t.id); }}><ThumbsUp /> That helped</Button>
                    )}
                    <Button size="sm" variant="ghost" asChild><Link href={raiseHref(t.queue, t.id)}>Still need help <ArrowRight /></Link></Button>
                  </div>
                </div>
              ))}
              {hits.tickets.map((t) => (
                <Link key={t.id} href={`/app/helpdesk/${t.id}`} className="flex items-center gap-2 rounded-xl border border-border bg-background p-3 text-sm hover:bg-subtle">
                  <span aria-hidden>🗂️</span>
                  <span className="min-w-0 flex-1"><span className="text-xs text-muted-foreground">Your earlier ticket · solved</span><span className="block truncate font-medium">#{t.number} {t.subject}</span></span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {hits.topics.length || hits.tickets.length ? 'Not answered?' : 'No quick answer for that yet.'}
                <Button size="sm" asChild><Link href={raiseHref()}><Plus /> Raise a ticket</Link></Button>
              </p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1 md:grid-cols-4">
          {(directory.data ?? []).map((d) => (
            <Link key={d.queue} href={raiseHref(d.queue)} className="emo-host m-lift group flex items-center gap-3 rounded-xl border border-border bg-background/70 p-3 hover:border-primary/40">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xl"><Emoji e={queues.info(d.queue).emoji} /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{d.label}</span>
                <span className="block truncate text-2xs text-muted-foreground">{replyTime(d.typicalReplyMinutes) ? `Usually replies in ${replyTime(d.typicalReplyMinutes)}` : queues.info(d.queue).text}</span>
                {d.head && <span className="flex items-center gap-1 text-2xs text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-success" /> {d.head.firstName} leads</span>}
              </span>
              <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
          {directory.isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[66px]" />)}
        </div>
      </div>
    </section>
  );
}

function TicketCard({ t }: { t: Ticket }) {
  const waiting = t.status === 'WAITING';
  const running = t.status === 'OPEN' || t.status === 'IN_PROGRESS';
  const due = running ? dueText(!t.firstRespondedAt ? t.firstResponseDueAt : t.resolutionDueAt) : null;
  return (
    <Link href={`/app/helpdesk/${t.id}`} className="block">
      <Card className={cn('m-lift space-y-3 p-4 transition-colors hover:border-foreground/20', waiting && 'border-warning/60 ring-4 ring-warning-soft')}>
        <div className="flex items-start gap-3">
          <TargetRing t={t} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-mono font-semibold">#{t.number}</span>
              <span>{t.queueEmoji} {t.queueLabel}</span>
              {t.category && <span>· {t.category.icon} {t.category.name}</span>}
              {(t.priority === 'HIGH' || t.priority === 'URGENT') && <Badge tone={PRIORITY[t.priority].tone} className="px-1.5 py-0 text-2xs">{PRIORITY[t.priority].label}</Badge>}
            </p>
            <p className="mt-0.5 truncate text-[15px] font-semibold">{t.subject}</p>
            <p className="text-xs text-muted-foreground">{waiting ? 'The team asked you something — reply to continue' : `Updated ${formatRelative(t.lastActivityAt)}`}</p>
          </div>
          {t.assignee ? (
            <span className="flex shrink-0 items-center gap-1.5 text-xs"><PersonAvatar person={t.assignee} size="sm" /> <span className="hidden font-medium sm:inline">{t.assignee.firstName}</span></span>
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground">Not picked up yet</span>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-border pt-3">
          <Journey t={t} className="flex-1" />
          {due && <span className={cn('shrink-0 text-2xs', due.late ? 'font-medium text-destructive' : 'text-muted-foreground')}>{!t.firstRespondedAt ? 'Reply ' : 'Fix '}{due.text}</span>}
          {waiting && <span className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">Reply</span>}
        </div>
      </Card>
    </Link>
  );
}
