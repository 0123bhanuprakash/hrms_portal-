'use client';

import React from 'react';
import { EmojiText } from '@/components/motion/emoji';
import Link from 'next/link';
import { toast } from 'sonner';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronRight, Copy, Heart, Mail, MapPin, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/feedback';
import { usePersonCard, type PersonBasic, type PersonCard } from '@/lib/company/profile';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Photo, TODAY, tintFor, todayText } from './photo-card';

const DAY_LABEL: Record<PersonCard['thisWeek'][number]['day'], { label: string; cls: string }> = {
  in: { label: 'In', cls: 'bg-success-soft text-success' },
  wfh: { label: 'Home', cls: 'bg-info-soft text-info' },
  away: { label: 'Away', cls: 'bg-warning-soft text-warning' },
  off: { label: 'Off', cls: 'bg-muted text-muted-foreground' },
  none: { label: '—', cls: 'bg-muted/50 text-muted-foreground' },
  later: { label: '', cls: 'border border-dashed border-border text-muted-foreground' },
};
const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const md = (k: string) => new Date(`2000-${k}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: 'UTC' });

function Mini({ p, note, onOpen, active }: { p: PersonBasic; note?: string; onOpen?: (id: string) => void; active?: boolean }) {
  return (
    <button type="button" onClick={() => onOpen?.(p.id)} disabled={!onOpen} className={cn('flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left', active ? 'border-primary/30 bg-primary-soft/40' : 'border-border hover:bg-subtle')}>
      <Photo person={p} className="h-9 w-9" rounded="rounded-lg" textClass="text-xs" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{p.firstName} {p.lastName}</span>
        <span className="block truncate text-xs text-muted-foreground">{note ?? p.designation?.name ?? ''}</span>
      </span>
    </button>
  );
}

/** Click someone in the directory: a quick look without leaving the page. */
export function QuickLook({ id, onClose, onOpen, canOpenProfile }: { id: string | null; onClose: () => void; onOpen: (id: string) => void; canOpenProfile: boolean }) {
  const q = usePersonCard(id);
  const c = q.data;
  return (
    <DialogPrimitive.Root open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-raised shadow-dialog focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right-8">
          <DialogPrimitive.Title className="sr-only">{c ? `${c.firstName} ${c.lastName}` : 'Person'}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Quick look</DialogPrimitive.Description>
          <div className={cn('relative h-32 shrink-0 bg-gradient-to-br', tintFor(c?.department?.id))}>
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-lg bg-white/85 p-1.5 text-stone-900 hover:bg-white" aria-label="Close"><X className="h-4 w-4" /></DialogPrimitive.Close>
            {c && <Photo person={c} className="absolute -bottom-12 left-5 h-28 w-28 border-4 border-raised shadow-lg" rounded="rounded-2xl" textClass="text-3xl" />}
          </div>
          {!c ? (
            <div className="space-y-3 p-5 pt-16"><Skeleton className="h-8 w-48" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
          ) : (
            <div className="flex flex-col gap-5 px-5 pb-6 pt-14">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold">{c.firstName} {c.lastName}</h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold"><i className={cn('h-1.5 w-1.5 rounded-full', TODAY[c.today.status].dot)} />{todayText(c.today)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{[c.designation?.name, c.department?.name].filter(Boolean).join(' · ')}</p>
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {c.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.location.name}</span>}
                  <span>Joined {formatDate(c.joiningDate)}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={`mailto:${c.email}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><Mail className="h-3.5 w-3.5" />Email</a>
                  <Link href={`/app/kudos?to=${c.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-subtle"><Heart className="h-3.5 w-3.5" />Send kudos</Link>
                  <button type="button" onClick={() => void navigator.clipboard?.writeText(c.email).then(() => toast.success('Email copied'))} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-subtle"><Copy className="h-3.5 w-3.5" />Copy email</button>
                  {canOpenProfile && <Link href={`/app/employees/${c.id}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-subtle">Full profile<ChevronRight className="h-3.5 w-3.5" /></Link>}
                </div>
              </div>

              <section>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Reporting line</h3>
                {c.reportingManager && (
                  <>
                    <Mini p={c.reportingManager} note={`${c.reportingManager.designation?.name ?? 'Manager'} · manager`} onOpen={onOpen} />
                    <span className="ml-6 block h-3 w-0.5 bg-border" />
                  </>
                )}
                <Mini p={c} note="you’re looking at" active />
                {c.directReportCount > 0 && (
                  <div className="ml-6 mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Leads {c.directReportCount}</span>
                    <span className="flex">
                      {c.subordinates.slice(0, 6).map((s, i) => (
                        <button key={s.id} type="button" onClick={() => onOpen(s.id)} title={`${s.firstName} ${s.lastName}`} className={cn('rounded-full ring-2 ring-raised', i > 0 && '-ml-2')}>
                          <Photo person={s} className="h-7 w-7" rounded="rounded-full" textClass="text-[10px]" />
                        </button>
                      ))}
                    </span>
                  </div>
                )}
              </section>

              {c.teammates.length > 0 && (
                <section>
                  <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Teammates · {c.department?.name}</h3>
                  <div className="flex flex-wrap gap-3">
                    {c.teammates.map((t) => (
                      <button key={t.id} type="button" onClick={() => onOpen(t.id)} className="w-14 text-center">
                        <Photo person={t} className="mx-auto h-12 w-12 transition-transform hover:scale-105" rounded="rounded-xl" textClass="text-sm" />
                        <span className="mt-1 block truncate text-[11px]">{t.firstName}</span>
                      </button>
                    ))}
                    {c.teammateCount > c.teammates.length && <span className="self-center text-xs text-muted-foreground">+{c.teammateCount - c.teammates.length}</span>}
                  </div>
                </section>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                {c.birthday && <Fact label={<EmojiText text="🎂 Birthday" />} value={md(c.birthday)} />}
                <Fact label={<EmojiText text="🏆 Work anniversary" />} value={`${md(c.anniversary.date.slice(5))} · ${c.anniversary.years} year${c.anniversary.years === 1 ? '' : 's'}`} />
                <Fact label={<EmojiText text="💛 Kudos received" />} value={`${c.kudos.total}${c.kudos.thisMonth ? ` · ${c.kudos.thisMonth} this month` : ''}`} />
              </div>

              <section>
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">This week</h3>
                <div className="grid grid-cols-5 gap-1.5">
                  {c.thisWeek.map((d, i) => (
                    <div key={d.date} className="text-center">
                      <span className="block text-[11px] text-muted-foreground">{WEEKDAY[i]}</span>
                      <span className={cn('mt-1 flex h-8 items-center justify-center rounded-lg text-xs font-semibold', DAY_LABEL[d.day].cls)}>{DAY_LABEL[d.day].label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <p className="text-xs text-muted-foreground">Phone and personal details stay on the full profile, for people allowed to see them.</p>
              {q.isFetching && <Badge tone="neutral" className="self-start">Updating…</Badge>}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Fact({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
