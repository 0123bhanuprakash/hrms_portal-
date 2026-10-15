'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Emoji } from '@/components/motion/emoji';
import Link from 'next/link';
import { toast } from 'sonner';
import { BarChart3, CalendarDays, CalendarPlus, CheckCheck, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText, Flame, Heart, Megaphone, Paperclip, Pin, Plus, Search, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { CATEGORIES, CATEGORY_ORDER, CategoryPill, ReactionBar, RsvpBar, audienceLabel, countdown, downloadIcs, eventWhen, plain, readTime } from '@/components/engagement/announcement-ui';
import { AnnouncementCover } from '@/components/engagement/cover';
import { StoryStrip, StoryViewer } from '@/components/engagement/stories';
import { useAccess } from '@/lib/access/use-access';
import { useAuthStore } from '@/store/useAuthStore';
import {
  downloadAnnouncementAttachment,
  useAnnouncements,
  useAnnouncementsOverview,
  useMarkSeen,
  useReactAnnouncement,
  useReadAll,
  type Announcement,
  type Category,
} from '@/lib/company/engagement';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

type Filter = 'all' | 'unread' | 'ack' | 'drafts';

export default function AnnouncementsPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const firstName = useAuthStore((s) => s.user?.firstName);
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState<Category | undefined>();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [showExpired, setShowExpired] = useState(false);
  const [story, setStory] = useState<{ items: Announcement[]; start: number } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [filter, category, debounced, showExpired]);

  const enabled = hasFeature('engage.announcements') && can('announcement.view');
  const drafts = filter === 'drafts';
  const list = useAnnouncements({ filter: drafts ? 'all' : filter, view: drafts ? 'drafts' : 'feed', category, search: debounced || undefined, page, includeExpired: showExpired });
  const unreadList = useAnnouncements({ filter: 'unread', limit: 20 }, enabled);
  const overview = useAnnouncementsOverview(enabled);
  const readAll = useReadAll();
  const seen = useSeenOnScroll();

  const plainFeed = filter === 'all' && !category && !debounced;
  const featured = plainFeed && page === 1 ? (overview.data?.featured ?? []) : [];
  const featuredIds = new Set(featured.map((f) => f.id));
  const rows = (list.data?.data ?? []).filter((a) => !featuredIds.has(a.id) || !plainFeed);
  const groups = useMemo(() => (drafts || !plainFeed ? [{ label: null as string | null, rows }] : groupByDay(rows)), [rows, drafts, plainFeed]);
  const unread = (unreadList.data?.data ?? []).filter((a) => !a.isMine && !a.readAt);
  // Story mode works on a snapshot (reading a post removes it from "unread"), with live reactions
  const latest = new Map([...(unreadList.data?.data ?? []), ...(list.data?.data ?? [])].map((a) => [a.id, a]));

  if (!accessLoading && !enabled) return <EmptyState icon={<ShieldCheck />} title="Announcements aren’t available" />;
  const meta = list.data?.meta;
  const canPost = meta?.canPost ?? false;
  const o = overview.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-primary">Engagement · Announcements</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">{greeting()}{firstName ? `, ${firstName}` : ''} <Emoji e="👋" play="appear" /></h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {meta?.unread ? `${meta.unread} update${meta.unread === 1 ? '' : 's'} since you last looked` : 'You’re all caught up'}
            {meta?.needsAck ? ` — ${meta.needsAck} need${meta.needsAck === 1 ? 's' : ''} your confirmation` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {!!meta?.unread && (
            <Button variant="secondary" loading={readAll.isPending} onClick={() => readAll.mutate(undefined, { onSuccess: (r) => toast.success(`Marked ${r.read} as read`), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not mark read')) })}>
              <CheckCheck /> Mark all read
            </Button>
          )}
          {canPost && <Button asChild><Link href="/app/announcements/new"><Plus /> New announcement</Link></Button>}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {plainFeed && unread.length > 1 && <StoryStrip items={unread} onOpen={(start) => setStory({ items: unread, start })} />}
          {featured.length > 0 && <Featured items={featured} />}

          <div className="flex flex-wrap items-center gap-2">
            {([
              ['all', 'All', null],
              ['unread', 'Unread', meta?.unread],
              ['ack', 'To confirm', meta?.needsAck],
              ...(canPost ? [['drafts', 'Drafts & scheduled', meta?.drafts] as const] : []),
            ] as Array<readonly [Filter, string, number | null | undefined]>).map(([id, label, n]) => (
              <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className={chip(filter === id)}>
                {label}{n ? <span className="rounded-full bg-primary/15 px-1.5 text-[10.5px] tabular-nums">{n}</span> : null}
              </button>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
            {CATEGORY_ORDER.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(category === c ? undefined : c)} aria-pressed={category === c} className={chip(category === c)}>
                {CATEGORIES[c].emoji} {CATEGORIES[c].label}
              </button>
            ))}
            <div className="relative ml-auto w-full sm:w-48">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="h-9 pl-8" aria-label="Search announcements" />
            </div>
          </div>

          {list.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}</div>
          ) : list.isLoadingError ? (
            <ErrorState message={getApiErrorMessage(list.error, 'Could not load announcements')} onRetry={() => list.refetch()} />
          ) : !rows.length && !featured.length ? (
            <EmptyState
              icon={<Megaphone />}
              title={drafts ? 'No drafts' : plainFeed ? 'No announcements yet' : filter !== 'all' ? <>You’re all caught up <Emoji e="🎉" play="appear" /></> : 'Nothing matches'}
              action={canPost && filter === 'all' ? <Button asChild><Link href="/app/announcements/new"><Plus /> New announcement</Link></Button> : undefined}
            />
          ) : (
            <>
              {groups.map((g) => (
                <section key={g.label ?? 'all'} className="space-y-2.5">
                  {g.label && <h2 className="px-1 pt-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{g.label}</h2>}
                  {g.rows.map((a) => <FeedCard key={a.id} a={a} observe={seen.observe} />)}
                </section>
              ))}
              {list.data && list.data.meta.totalPages > 1 && <Pagination page={page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />}
            </>
          )}
          {canPost && !drafts && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={showExpired} onChange={(e) => setShowExpired(e.target.checked)} /> Show expired
            </label>
          )}
        </div>

        <aside className="space-y-4">
          {o && <ReadingCard reading={o.reading} unread={meta?.unread ?? 0} onCatchUp={unread.length ? () => setStory({ items: unread, start: 0 }) : undefined} />}
          {o && o.toConfirm.length > 0 && (
            <Card className="border-warning/40 bg-gradient-to-b from-warning-soft/60 to-surface">
              <CardHeader icon={<CheckCircle2 />} title="Needs your confirmation" />
              <ul className="space-y-3 px-5 pb-5">
                {o.toConfirm.map((t) => (
                  <li key={t.id}>
                    <Link href={`/app/announcements/${t.id}`} className="flex items-start gap-2.5 rounded-md hover:opacity-80">
                      <span className="text-xl leading-none">{t.coverEmoji ?? CATEGORIES[t.category]?.emoji}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{t.title}</span>
                        <span className="block text-xs text-muted-foreground">{t.ackDueAt ? dueText(t.ackDueAt) : `Posted ${formatRelative(t.publishedAt)}`}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {o && <ComingUp events={o.events} />}
          {o?.mine && (
            <Card>
              <CardHeader icon={<BarChart3 />} title="Your posts this month" />
              <div className="space-y-3 px-5 pb-5">
                <div className="grid grid-cols-3 gap-2">
                  {[['Posts', String(o.mine.posts)], ['Avg. read', pct(o.mine.avgReadPct)], ['Confirmed', pct(o.mine.avgConfirmPct)]].map(([l, v]) => (
                    <div key={l}><p className="text-xs text-muted-foreground">{l}</p><p className="text-lg font-semibold tabular-nums">{v}</p></div>
                  ))}
                </div>
                {o.mine.lagging && (
                  <p className="text-xs text-muted-foreground">
                    “{o.mine.lagging.title}” — {o.mine.lagging.waiting} {o.mine.lagging.waiting === 1 ? 'person hasn’t' : 'people haven’t'} confirmed.{' '}
                    <Link href={`/app/announcements/${o.mine.lagging.id}#reach`} className="font-semibold text-primary hover:underline">Nudge them</Link>
                  </p>
                )}
              </div>
            </Card>
          )}
          {o && o.mostLoved.length > 0 && (
            <Card>
              <CardHeader icon={<Heart />} title="Most loved this week" />
              <ol className="space-y-2.5 px-5 pb-5">
                {o.mostLoved.map((m) => (
                  <li key={m.id}>
                    <Link href={`/app/announcements/${m.id}`} className="flex items-center gap-2.5 hover:opacity-80">
                      <span className="text-lg leading-none">{m.coverEmoji ?? CATEGORIES[m.category]?.emoji}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.title}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">❤️ {m.reactions}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Card>
          )}
          {o && o.documents.length > 0 && (
            <Card>
              <CardHeader icon={<FileText />} title="Policies & documents" />
              <ul className="space-y-2 px-5 pb-5">
                {o.documents.map((d) => (
                  <li key={d.id}>
                    <button type="button" className="flex w-full items-center gap-2 text-left text-sm hover:text-primary" onClick={() => downloadAnnouncementAttachment({ id: d.id, attachmentName: d.attachmentName }).catch((e) => toast.error(getApiErrorMessage(e, 'Could not download')))}>
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-medium">{d.attachmentName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(d.publishedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      {story && <StoryViewer items={story.items.map((s) => latest.get(s.id) ?? s)} start={story.start} onClose={() => setStory(null)} />}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

const chip = (on: boolean) =>
  cn('inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors', on ? 'border-primary/40 bg-primary-soft text-primary-soft-foreground' : 'border-border bg-surface text-muted-foreground hover:text-foreground');
const pct = (n: number | null) => (n === null ? '—' : `${n}%`);
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
function dueText(d: string) {
  const days = Math.round((new Date(`${d.slice(0, 10)}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);
  return days < 0 ? `Was due ${formatDate(d)}` : days === 0 ? 'Due today' : `Due ${formatDate(d)} · ${days} day${days === 1 ? '' : 's'} left`;
}
function groupByDay(rows: Announcement[]) {
  const today = new Date(new Date().toDateString()).getTime();
  const out: Array<{ label: string | null; rows: Announcement[] }> = [
    { label: 'Pinned', rows: [] },
    { label: 'Today', rows: [] },
    { label: 'This week', rows: [] },
    { label: 'Earlier', rows: [] },
  ];
  for (const a of rows) {
    const t = new Date(a.publishedAt).getTime();
    if (a.pinned) out[0]!.rows.push(a);
    else if (t >= today) out[1]!.rows.push(a);
    else if (t >= today - 6 * 86_400_000) out[2]!.rows.push(a);
    else out[3]!.rows.push(a);
  }
  return out.filter((g) => g.rows.length);
}

/** Marks posts read once they've been on screen for a moment (batched). */
function useSeenOnScroll() {
  const mark = useMarkSeen();
  const queue = useRef(new Set<string>());
  const done = useRef(new Set<string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    const pending = timers.current;
    const flush = setInterval(() => {
      if (!queue.current.size) return;
      const ids = [...queue.current].slice(0, 50);
      ids.forEach((id) => queue.current.delete(id));
      mark.mutate(ids);
    }, 2500);
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.seenId;
          if (!id || done.current.has(id)) continue;
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            if (!timers.current.has(id))
              timers.current.set(id, setTimeout(() => {
                done.current.add(id);
                queue.current.add(id);
                observer.current?.unobserve(e.target);
              }, 1500));
          } else {
            clearTimeout(timers.current.get(id));
            timers.current.delete(id);
          }
        }
      },
      { threshold: [0, 0.6] },
    );
    return () => {
      clearInterval(flush);
      observer.current?.disconnect();
      pending.forEach((t) => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {
    observe: (el: HTMLElement | null) => {
      if (el && observer.current && el.dataset.seenId && !done.current.has(el.dataset.seenId)) observer.current.observe(el);
    },
  };
}

// ─── Featured carousel ──────────────────────────────────────

function Featured({ items }: { items: Announcement[] }) {
  const [i, setI] = useState(0);
  const [hover, setHover] = useState(false);
  const n = items.length;
  useEffect(() => {
    if (n < 2 || hover) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 8000);
    return () => clearInterval(t);
  }, [n, hover]);
  const a = items[Math.min(i, n - 1)]!;
  const label = a.pinned ? 'Pinned' : a.eventAt ? 'Coming up' : a.category === 'urgent' ? 'Urgent' : 'Featured';
  return (
    <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Link key={a.id} href={`/app/announcements/${a.id}`} className="group block overflow-hidden rounded-2xl text-white shadow-card animate-in fade-in-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <AnnouncementCover a={a} size="hero" className="min-h-[230px]">
          <div className="flex h-full min-h-[230px] max-w-xl flex-col justify-end gap-2 p-6 pr-40 sm:pr-56">
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold backdrop-blur">{a.pinned ? <Pin className="h-3 w-3" /> : a.eventAt ? <CalendarDays className="h-3 w-3" /> : null} {label}</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold backdrop-blur">{CATEGORIES[a.category]?.emoji} {CATEGORIES[a.category]?.label}{a.eventAt ? ` · ${eventWhen(a.eventAt)}` : ''}</span>
              {a.requiresAck && !a.acknowledgedAt && !a.isMine && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950">Please confirm{a.ackDueAt ? ` by ${formatDate(a.ackDueAt)}` : ''}</span>}
            </div>
            <h2 className="text-2xl font-bold leading-tight drop-shadow sm:text-[28px]">{a.title}</h2>
            <p className="line-clamp-2 text-sm text-white/90 drop-shadow">{plain(a.body)}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <RsvpBar a={a} onDark />
              {!!a.goingFaces?.length && (
                <span className="flex items-center gap-2 text-xs text-white/85">
                  <span className="flex -space-x-2">{a.goingFaces.slice(0, 4).map((f) => <PersonAvatar key={f.id} person={f} size="xs" className="ring-2 ring-white/70" />)}</span>
                  {a.rsvp.going} going
                </span>
              )}
              {!a.eventAt && <span className="text-xs text-white/80">{a.author ? `${a.author.firstName} ${a.author.lastName}` : 'HR'} · {formatRelative(a.publishedAt)}</span>}
            </div>
          </div>
        </AnnouncementCover>
      </Link>
      {n > 1 && (
        <>
          <div className="absolute bottom-4 right-5 flex gap-1.5">
            {items.map((x, k) => (
              <button key={x.id} type="button" onClick={() => setI(k)} aria-label={`Show ${x.title}`} className={cn('h-2 rounded-full bg-white/50 transition-all', k === i ? 'w-6 bg-white' : 'w-2')} />
            ))}
          </div>
          <button type="button" onClick={() => setI((i - 1 + n) % n)} className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/25 p-1.5 text-white backdrop-blur hover:bg-black/40 group-hover:block sm:block" aria-label="Previous"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setI((i + 1) % n)} className="absolute right-3 top-3 rounded-full bg-black/25 p-1.5 text-white backdrop-blur hover:bg-black/40" aria-label="Next"><ChevronRight className="h-4 w-4" /></button>
        </>
      )}
    </div>
  );
}

// ─── Feed cards (one look per type) ─────────────────────────

function FeedCard({ a, observe }: { a: Announcement; observe: (el: HTMLElement | null) => void }) {
  const unread = a.status === 'published' && !a.readAt && !a.isMine;
  const needsAck = a.requiresAck && !a.acknowledgedAt && !a.isMine && a.status === 'published';
  const href = a.status === 'published' ? `/app/announcements/${a.id}` : `/app/announcements/${a.id}/edit`;
  const urgent = a.category === 'urgent';
  return (
    <div
      ref={unread ? observe : undefined}
      data-seen-id={unread ? a.id : undefined}
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-surface shadow-card transition-all hover:-translate-y-0.5 hover:shadow-md',
        urgent ? 'border-destructive/40' : 'border-border',
        unread && 'bg-gradient-to-r from-primary-soft/40 via-surface to-surface',
        a.expired && 'opacity-60',
      )}
    >
      {urgent && <span className="absolute inset-y-0 left-0 w-1 bg-destructive" aria-hidden />}
      <Link href={href} className="flex gap-4 p-4">
        {a.eventAt ? (
          <DateTile iso={a.eventAt} />
        ) : (
          <span className={cn('relative shrink-0 overflow-hidden rounded-xl', urgent && 'motion-safe:animate-pulse')}>
            <AnnouncementCover a={a} size="tile" className="h-[72px] w-[88px]" />
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryPill category={a.category} />
            {a.status === 'draft' && <Badge tone="neutral"><FileText className="h-3 w-3" /> Draft</Badge>}
            {a.status === 'scheduled' && <Badge tone="info"><Clock className="h-3 w-3" /> Goes out {formatDateTime(a.publishedAt)}</Badge>}
            {a.pinned && <Badge tone="primary"><Pin className="h-3 w-3" /> Pinned</Badge>}
            {needsAck && <Badge tone="warning">Please confirm{a.ackDueAt ? ` · by ${formatDate(a.ackDueAt)}` : ''}</Badge>}
            {a.requiresAck && a.acknowledgedAt && <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> Confirmed</Badge>}
            {a.audience !== 'COMPANY' && <Badge tone="outline">{audienceLabel(a)}</Badge>}
            {a.expired && <Badge>Expired</Badge>}
            {a.attachmentName && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-label="Has an attachment" />}
          </div>
          <p className={cn('text-[15px] leading-snug', unread ? 'font-bold' : 'font-semibold')}>{a.title}</p>
          <p className="line-clamp-2 text-sm text-muted-foreground">{plain(a.body)}</p>
          {a.eventAt && (
            <p className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
              <span className="font-semibold text-foreground">{eventWhen(a.eventAt)}{a.eventPlace ? ` · ${a.eventPlace}` : ''}</span>
              <span className="text-muted-foreground">{countdown(a.eventAt)}</span>
              {!!a.goingFaces?.length && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="flex -space-x-1.5">{a.goingFaces.map((f) => <PersonAvatar key={f.id} person={f} size="xs" className="h-5 w-5 ring-2 ring-surface" />)}</span>
                  {a.rsvp.going} going
                </span>
              )}
            </p>
          )}
          {a.requiresAck && typeof a.confirmedPct === 'number' && (
            <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-32 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-success transition-[width] duration-700" style={{ width: `${a.confirmedPct}%` }} /></span>
              {a.confirmedPct}% confirmed
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
            {a.author && <PersonAvatar person={a.author} size="xs" />}
            <span>{a.author ? `${a.author.firstName} ${a.author.lastName}` : 'HR'} · {a.status === 'published' ? formatRelative(a.publishedAt) : `edited ${formatRelative(a.updatedAt)}`} · {readTime(a.body)}</span>
          </div>
        </div>
        {unread && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary motion-safe:animate-[m-live_2s_ease-out_infinite]" aria-label="Unread" />}
      </Link>
      {a.status === 'published' && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-2">
          <ReactionBar a={a} size="sm" />
          <div className="ml-auto flex items-center gap-2">
            {a.eventAt && <RsvpBar a={a} />}
            {a.eventAt && (
              <Button size="sm" variant="ghost" onClick={() => downloadIcs(a)}><CalendarPlus /> Add to calendar</Button>
            )}
            {a.category === 'celebrate' && a.allowReactions && <WaveButton a={a} />}
            {needsAck && <Button size="sm" asChild><Link href={href}>Read &amp; confirm</Link></Button>}
          </div>
        </div>
      )}
    </div>
  );
}

function DateTile({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <span className="flex h-[72px] w-[72px] shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-subtle text-center">
      <span className="text-[10px] font-extrabold uppercase text-destructive">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
      <span className="text-2xl font-bold leading-none">{d.getDate()}</span>
      <span className="mt-0.5 text-[10px] text-muted-foreground">{d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
    </span>
  );
}

/** 👋 waves on hover; waving floats up 3 little hands. */
function WaveButton({ a }: { a: Announcement }) {
  const react = useReactAnnouncement();
  const [fire, setFire] = useState(0);
  const mine = a.reactions.find((r) => r.emoji === '👋')?.mine;
  return (
    <Button
      size="sm"
      variant={mine ? 'soft' : 'secondary'}
      aria-pressed={Boolean(mine)}
      className="emo-host"
      onClick={() => {
        if (!mine) setFire((n) => n + 1);
        react.mutate({ id: a.id, emoji: '👋' });
      }}
    >
      <Emoji e="👋" fire={fire} burst /> {mine ? 'Waved' : 'Wave'}
    </Button>
  );
}

// ─── Right rail ─────────────────────────────────────────────

function ReadingCard({ reading, unread, onCatchUp }: { reading: { total: number; read: number; streak: number; allConfirmed: boolean }; unread: number; onCatchUp?: () => void }) {
  const p = reading.total ? Math.round((reading.read / reading.total) * 100) : 100;
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <Card className="flex flex-col items-center gap-2 p-5 text-center">
      <svg viewBox="0 0 84 84" className="h-24 w-24 -rotate-90" aria-hidden>
        <circle cx="42" cy="42" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle cx="42" cy="42" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} className="transition-[stroke-dasharray] duration-700" />
      </svg>
      <div className="-mt-[74px] mb-8 flex flex-col items-center">
        <span className="text-xl font-bold tabular-nums">{p}%</span>
        <span className="text-[10px] text-muted-foreground">read</span>
      </div>
      <p className="text-sm font-semibold">{reading.total ? `${reading.read} of ${reading.total} read this month` : 'Nothing new for you this month'}</p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {reading.streak > 1 && <Badge tone="warning"><Flame className="h-3 w-3" /> {reading.streak}-day streak</Badge>}
        {reading.allConfirmed && <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> All confirmed</Badge>}
      </div>
      {onCatchUp && unread > 0 && <Button size="sm" variant="secondary" className="mt-1" onClick={onCatchUp}>Catch up on {unread}</Button>}
    </Card>
  );
}

function ComingUp({ events }: { events: Array<{ id: string; title: string; eventAt: string; eventPlace: string | null; going: number; mine: string | null }> }) {
  const today = new Date(new Date().toDateString());
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  const has = (d: Date) => events.some((e) => new Date(e.eventAt).toDateString() === d.toDateString());
  return (
    <Card>
      <CardHeader icon={<CalendarDays />} title="Coming up" />
      <div className="space-y-3 px-5 pb-5">
        <div className="grid grid-cols-7 gap-1">
          {week.map((d) => {
            const isToday = d.toDateString() === today.toDateString();
            return (
              <div key={d.toISOString()} className={cn('rounded-lg py-1.5 text-center', isToday ? 'bg-primary text-primary-foreground' : 'bg-subtle')}>
                <p className="text-[10px] opacity-75">{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</p>
                <p className="text-sm font-bold">{d.getDate()}</p>
                <span className={cn('mx-auto mt-0.5 block h-1 w-1 rounded-full', has(d) ? (isToday ? 'bg-primary-foreground' : 'bg-primary') : 'bg-transparent')} />
              </div>
            );
          })}
        </div>
        {!events.length ? (
          <p className="text-xs text-muted-foreground">No events coming up.</p>
        ) : (
          <ul className="space-y-2.5">
            {events.map((e) => {
              const d = new Date(e.eventAt);
              return (
                <li key={e.id}>
                  <Link href={`/app/announcements/${e.id}`} className="flex items-start gap-3 hover:opacity-80">
                    <span className="w-16 shrink-0 text-xs font-bold text-primary">{d.toLocaleDateString(undefined, { weekday: 'short' })} {d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{e.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[e.eventPlace, e.going ? `${e.going} going` : null, e.mine === 'going' ? 'you’re going' : null].filter(Boolean).join(' · ') || countdown(e.eventAt)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
