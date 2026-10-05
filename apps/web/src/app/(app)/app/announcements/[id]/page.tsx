'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, BellRing, Building2, CalendarDays, CalendarPlus, CheckCircle2, Download, Eye, Mail, MapPin, Pencil, Pin, PinOff, SearchX, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { CATEGORIES, CategoryPill, ReactionBar, RichText, RsvpBar, audienceLabel, countdown, downloadIcs, eventWhen, readTime } from '@/components/engagement/announcement-ui';
import { AnnouncementCover } from '@/components/engagement/cover';
import {
  downloadAnnouncementAttachment,
  useAcknowledge,
  useAnnouncement,
  useAnnouncementReport,
  useDeleteAnnouncement,
  useNudge,
  usePinAnnouncement,
  type Announcement,
  type AnnouncementReport,
} from '@/lib/company/engagement';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

export default function AnnouncementPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const q = useAnnouncement(id);
  const ack = useAcknowledge();
  const del = useDeleteAnnouncement();
  const pin = usePinAnnouncement();
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const back = (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/app/announcements"><ArrowLeft /> Announcements</Link>
    </Button>
  );
  if (q.isLoading) return <Skeleton className="h-80 w-full" />;
  if (q.isError) {
    const status = (q.error as { response?: { status?: number } })?.response?.status;
    return status === 404 ? <EmptyState icon={<SearchX />} title="Announcement not found" action={back} /> : <ErrorState message={getApiErrorMessage(q.error)} onRetry={() => q.refetch()} />;
  }
  const a = q.data!;
  const live = a.status === 'published';

  const confirm = async () => {
    try {
      await ack.mutateAsync(a.id);
      await q.refetch();
      toast.success('Thanks — confirmed');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not confirm'));
    }
  };
  const download = async () => {
    setDownloading(true);
    try {
      await downloadAnnouncementAttachment(a);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not download'));
    } finally {
      setDownloading(false);
    }
  };
  const togglePin = () =>
    pin.mutate(
      { id: a.id, pinned: !a.pinned },
      { onSuccess: () => { toast.success(a.pinned ? 'Unpinned' : 'Pinned for everyone — any other pin was removed'); void q.refetch(); }, onError: (e) => toast.error(getApiErrorMessage(e, 'Could not pin')) },
    );

  return (
    <div className="space-y-4">
      <ReadingProgress />
      <div>{back}</div>
      <div className={cn('grid gap-4', a.canEdit && live && 'xl:grid-cols-[minmax(0,1fr)_360px]')}>
        <Card className="min-w-0 overflow-hidden">
          <AnnouncementCover a={a} size="banner" burst className="h-48 sm:h-60">
            {a.pinned && <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur"><Pin className="h-3 w-3" /> Pinned</span>}
            {a.canEdit && (
              <div className="absolute right-3 top-3 flex gap-1.5">
                {a.canPin && live && <Button size="sm" variant="secondary" onClick={togglePin} loading={pin.isPending}>{a.pinned ? <><PinOff /> Unpin</> : <><Pin /> Pin for everyone</>}</Button>}
                <Button size="sm" variant="secondary" asChild><Link href={`/app/announcements/${a.id}/edit`}><Pencil /> Edit</Link></Button>
                <Button size="icon-sm" variant="secondary" onClick={() => setDeleting(true)} aria-label="Delete"><Trash2 /></Button>
              </div>
            )}
          </AnnouncementCover>
          <div className="space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-1.5">
              <CategoryPill category={a.category} />
              {a.status === 'draft' && <Badge tone="neutral">Draft — only you can see it</Badge>}
              {a.status === 'scheduled' && <Badge tone="info">Goes out {formatDateTime(a.publishedAt)}</Badge>}
              {a.requiresAck && !a.acknowledgedAt && live && !a.isMine && <Badge tone="warning">Please confirm{a.ackDueAt ? ` by ${formatDate(a.ackDueAt)}` : ''}</Badge>}
              {a.sendEmail && <Badge tone="outline"><Mail className="h-3 w-3" /> Emailed</Badge>}
              <Badge tone="outline">{a.audience === 'DEPARTMENTS' ? <Building2 className="h-3 w-3" /> : a.audience === 'LOCATIONS' ? <MapPin className="h-3 w-3" /> : <Users className="h-3 w-3" />} {audienceLabel(a)}</Badge>
              {a.expiresAt && <Badge tone="outline">{a.expired ? 'Expired' : 'Until'} {formatDate(a.expiresAt)}</Badge>}
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight">{a.title}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {a.author && <PersonAvatar person={a.author} size="sm" />}
              <span>
                <b className="text-foreground">{a.author ? `${a.author.firstName} ${a.author.lastName}` : 'HR'}</b>
                {a.author?.title ? ` · ${a.author.title}` : ''} · {formatDateTime(a.publishedAt)} · {readTime(a.body)}
              </span>
            </div>
            {a.eventAt && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-subtle/60 p-3">
                <CalendarDays className="h-5 w-5 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{eventWhen(a.eventAt)}{a.eventPlace ? ` · ${a.eventPlace}` : ''}</p>
                  <p className="text-xs text-muted-foreground">Starts <Countdown iso={a.eventAt} />{a.rsvp.going ? ` · ${a.rsvp.going} going` : ''}</p>
                </div>
                {!!a.goingFaces?.length && <span className="flex -space-x-2">{a.goingFaces.map((g) => <PersonAvatar key={g.id} person={g} size="xs" className="ring-2 ring-surface" />)}</span>}
                <RsvpBar a={a} />
                <Button size="sm" variant="ghost" onClick={() => downloadIcs(a)}><CalendarPlus /> .ics</Button>
              </div>
            )}
            <RichText text={a.body} className="text-[15px]" />
            {a.attachmentName && (
              <Button variant="secondary" size="sm" onClick={download} loading={downloading}><Download /> {a.attachmentName}</Button>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <ReactionBar a={a} />
              {a.seen && a.seen.count > 0 && (
                <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" /> Seen by{' '}
                  {a.seen.faces.length > 0 && <span className="flex -space-x-1.5">{a.seen.faces.map((p) => <PersonAvatar key={p.id} person={p} size="xs" className="h-5 w-5 ring-2 ring-surface" />)}</span>}
                  {a.seen.count} {a.seen.count === 1 ? 'person' : 'people'}
                </span>
              )}
            </div>
            {a.requiresAck && live && !a.isMine && (
              <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3', a.acknowledgedAt ? 'bg-success-soft' : 'bg-warning-soft')}>
                {a.acknowledgedAt ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-success"><CheckCircle2 className="h-4 w-4" /> You confirmed this {formatRelative(a.acknowledgedAt)}</p>
                ) : (
                  <>
                    <div>
                      <p className="text-sm font-semibold">Please confirm you’ve read and understood this</p>
                      {a.ackDueAt && <p className="text-xs text-muted-foreground">By {formatDate(a.ackDueAt)}</p>}
                    </div>
                    <Button onClick={confirm} loading={ack.isPending}><CheckCircle2 /> I have read this</Button>
                  </>
                )}
              </div>
            )}
          </div>
        </Card>

        {a.canEdit && live && <Reach a={a} />}
        {a.related && a.related.length > 0 && (
          <div className={cn('space-y-2', a.canEdit && live && 'xl:col-start-1')}>
            <p className="px-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">More like this</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {a.related.map((r) => (
                <Link key={r.id} href={`/app/announcements/${r.id}`} className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5 shadow-card transition-all hover:-translate-y-0.5">
                  <span className="shrink-0 overflow-hidden rounded-lg"><AnnouncementCover a={{ ...r, coverScene: null, coverMotion: 'off', coverFocusX: 50, coverFocusY: 50, coverDim: 25 }} size="thumb" className="h-12 w-14" /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold group-hover:text-primary">{r.title}</span>
                    <span className="block text-xs text-muted-foreground">{CATEGORIES[r.category]?.label} · {formatRelative(r.publishedAt)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleting}
        onClose={() => setDeleting(false)}
        isDanger
        isLoading={del.isPending}
        title="Delete this announcement?"
        description="It disappears for everyone."
        confirmText="Delete"
        onConfirm={async () => {
          try {
            await del.mutateAsync(a.id);
            toast.success('Announcement deleted');
            router.push('/app/announcements');
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not delete'));
          }
        }}
      />
    </div>
  );
}

/** Poster (and HR): delivered → opened → confirmed, by department, who is still waiting, nudge. */
function Reach({ a }: { a: Announcement }) {
  const report = useAnnouncementReport(a.id);
  const nudge = useNudge();
  const [tab, setTab] = useState<'waiting' | 'done' | 'rsvp'>('waiting');
  const r = report.data;
  const people = useMemo(() => r?.people ?? [], [r]);
  const done = (p: AnnouncementReport['people'][number]) => (a.requiresAck ? Boolean(p.acknowledgedAt) : Boolean(p.readAt));
  const waiting = people.filter((p) => !done(p));
  const depts = useMemo(() => {
    const m = new Map<string, { name: string; total: number; read: number; done: number }>();
    for (const p of people) {
      const k = p.employee?.department?.name ?? 'No department';
      const row = m.get(k) ?? { name: k, total: 0, read: 0, done: 0 };
      row.total++;
      if (p.readAt) row.read++;
      if (p.acknowledgedAt) row.done++;
      m.set(k, row);
    }
    return [...m.values()].sort((x, y) => y.total - x.total);
  }, [people]);
  const shown = tab === 'rsvp' ? people.filter((p) => p.rsvp) : tab === 'done' ? people.filter(done) : waiting;

  const exportCsv = () => {
    const rows = [['Name', 'Email', 'Department', 'Read', 'Confirmed', ...(a.eventAt ? ['RSVP'] : [])], ...people.map((p) => [`${p.firstName} ${p.lastName}`, p.email, p.employee?.department?.name ?? '', p.readAt ?? '', p.acknowledgedAt ?? '', ...(a.eventAt ? [p.rsvp ?? ''] : [])])];
    const csv = rows.map((row) => row.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${a.title.slice(0, 40).replace(/[^\w ]+/g, '').trim() || 'announcement'}-reach.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (report.isLoading || !r) return <Skeleton className="h-96" />;
  const pct = (n: number) => (r.total ? Math.round((n / r.total) * 100) : 0);
  const steps = [
    ['Delivered', r.total, 100, 'bg-primary'],
    ['Opened', r.read, pct(r.read), 'bg-primary/75'],
    ...(a.requiresAck ? [['Confirmed', r.acknowledged, pct(r.acknowledged), 'bg-success']] : []),
  ] as Array<[string, number, number, string]>;

  return (
    <div id="reach" className="space-y-4">
      <Card>
        <CardHeader icon={<Eye />} title="Reach" description="Only the poster and HR see this" />
        <div className="space-y-2 px-5 pb-5">
          {steps.map(([label, n, p, tone]) => (
            <div key={label} className="relative h-9 overflow-hidden rounded-lg bg-muted">
              <div className={cn('absolute inset-y-0 left-0 rounded-lg transition-[width] duration-700', tone)} style={{ width: `${Math.max(p, 4)}%` }} />
              <div className="relative flex h-full items-center justify-between px-3 text-xs font-semibold">
                <span className={p > 25 ? 'text-white' : ''}>{label}</span>
                <span className="tabular-nums">{n}{label !== 'Delivered' ? ` · ${p}%` : ''}</span>
              </div>
            </div>
          ))}
          {a.eventAt && <p className="text-xs text-muted-foreground">{a.rsvp.going} going · {a.rsvp.maybe} maybe</p>}
        </div>
      </Card>

      {depts.length > 1 && (
        <Card>
          <CardHeader icon={<Building2 />} title="By department" />
          <ul className="space-y-2.5 px-5 pb-5">
            {depts.map((d) => (
              <li key={d.name}>
                <div className="flex text-xs"><span className="flex-1 font-medium">{d.name}</span><span className="text-muted-foreground">{a.requiresAck ? `${d.done}/${d.total} confirmed` : `${d.read}/${d.total} read`}</span></div>
                <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted">
                  <span className="bg-success" style={{ width: `${((a.requiresAck ? d.done : d.read) / d.total) * 100}%` }} />
                  {a.requiresAck && <span className="bg-primary/40" style={{ width: `${((d.read - d.done) / d.total) * 100}%` }} />}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          icon={<Users />}
          title={a.requiresAck ? 'Confirmations' : 'Read by'}
          action={<Button size="sm" variant="ghost" onClick={exportCsv}><Download /> Export</Button>}
        />
        <div className="px-5">
          <Tabs
            tabs={[
              { id: 'waiting' as const, label: a.requiresAck ? 'Not confirmed' : 'Not read', count: waiting.length },
              { id: 'done' as const, label: a.requiresAck ? 'Confirmed' : 'Read', count: people.length - waiting.length },
              ...(a.eventAt ? [{ id: 'rsvp' as const, label: 'Replies', count: people.filter((p) => p.rsvp).length }] : []),
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        {!shown.length ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">{tab === 'waiting' ? 'Everyone is done. 🎉' : 'Nobody yet.'}</p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {shown.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <PersonAvatar person={{ firstName: p.firstName, lastName: p.lastName, avatarUrl: p.employee?.avatarUrl ?? p.avatarUrl }} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.firstName} {p.lastName}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.employee?.department?.name ?? p.email}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {tab === 'rsvp' ? ({ going: 'Going', maybe: 'Maybe', no: 'Can’t make it' } as const)[p.rsvp!] : p.acknowledgedAt ? `Confirmed ${formatRelative(p.acknowledgedAt)}` : p.readAt ? `Opened ${formatRelative(p.readAt)}` : 'Not opened'}
                </span>
              </li>
            ))}
          </ul>
        )}
        {waiting.length > 0 && (
          <div className="space-y-1 border-t border-border px-5 py-3">
            <Button
              size="sm"
              loading={nudge.isPending}
              onClick={() =>
                nudge.mutate(a.id, {
                  onSuccess: (res) => { toast.success(`Reminder sent to ${res.nudged} ${res.nudged === 1 ? 'person' : 'people'}`); void report.refetch(); },
                  onError: (e) => toast.error(getApiErrorMessage(e, 'Could not nudge')),
                })
              }
            >
              <BellRing /> Nudge {waiting.length} {waiting.length === 1 ? 'person' : 'people'}
            </Button>
            <p className="text-xs text-muted-foreground">
              At most once every 12 hours{r.lastNudgedAt ? ` · last nudge ${formatRelative(r.lastNudgedAt)}` : ''}{a.ackDueAt ? ` · automatic reminder 2 days before ${formatDate(a.ackDueAt)}` : ''}.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Thin bar at the top that fills as you scroll through the post. */
function ReadingProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 40 ? Math.min(1, window.scrollY / max) : 0);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => {
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
    };
  }, []);
  if (!p) return null;
  return <div className="fixed left-0 top-0 z-50 h-[3px] rounded-r-full bg-gradient-to-r from-primary to-pink-500 transition-[width] duration-150" style={{ width: `${p * 100}%` }} aria-hidden />;
}

/** Live countdown to an event. */
function Countdown({ iso }: { iso: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  return <>{countdown(iso)}</>;
}
