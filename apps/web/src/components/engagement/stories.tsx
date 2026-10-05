'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Pause, Play, X } from 'lucide-react';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useAcknowledge, useMarkSeen, useReactAnnouncement, type Announcement } from '@/lib/company/engagement';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { AnnouncementCover, useReducedMotion } from './cover';
import { CATEGORIES, eventWhen, plain, readTime } from './announcement-ui';

const SLIDE_MS = 7000;

/** "Catch up" + a ring per unread post (like stories). */
export function StoryStrip({ items, onOpen }: { items: Announcement[]; onOpen: (index: number) => void }) {
  if (!items.length) return null;
  const minutes = Math.max(1, Math.round(items.reduce((n, a) => n + a.body.split(/\s+/).length, 0) / 200));
  return (
    <div className="flex items-center gap-4 overflow-x-auto rounded-2xl border border-border bg-surface px-4 py-3 shadow-card [scrollbar-width:thin]">
      <button type="button" onClick={() => onOpen(0)} className="group flex shrink-0 flex-col items-center gap-1 text-center" aria-label={`Catch up on ${items.length} posts`}>
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card transition-transform group-hover:scale-105"><Play className="ml-0.5 h-5 w-5" /></span>
        <span className="text-xs font-semibold">Catch up</span>
        <span className="text-[10px] text-muted-foreground">{items.length} · ~{minutes} min</span>
      </button>
      <span className="h-14 w-px shrink-0 bg-border" />
      {items.map((a, i) => (
        <button key={a.id} type="button" onClick={() => onOpen(i)} className="group flex w-16 shrink-0 flex-col items-center gap-1 text-center" title={a.title}>
          <span className="rounded-full bg-[conic-gradient(#f59e0b,#ec4899,#6366f1,#f59e0b)] p-[3px] transition-transform group-hover:scale-105">
            <span className="block overflow-hidden rounded-full border-[3px] border-surface">
              <AnnouncementCover a={a} size="thumb" className="h-12 w-12" />
            </span>
          </span>
          <span className="w-full truncate text-[11px] font-semibold">{a.title}</span>
        </button>
      ))}
    </div>
  );
}

/** Full-screen story mode: tap / arrow keys / swipe; posts are marked read as you go. */
export function StoryViewer({ items, start, onClose }: { items: Announcement[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const seen = useMarkSeen();
  const ack = useAcknowledge();
  const react = useReactAnnouncement();
  const reduce = useReducedMotion();
  const drag = useRef<number | null>(null);
  const a = items[index];
  // A post that asks to be confirmed waits until it is
  const waiting = Boolean(a && a.requiresAck && !a.acknowledgedAt && !acked.has(a.id) && !a.isMine);

  const go = useCallback(
    (to: number) => {
      if (to >= items.length) {
        toast.success('You’re all caught up 🎉');
        onClose();
        return;
      }
      setIndex(Math.max(0, to));
      setProgress(0);
    },
    [items.length, onClose],
  );

  // Mark each post read when it is shown
  const markedRef = useRef(new Set<string>());
  useEffect(() => {
    if (!a || markedRef.current.has(a.id) || a.readAt) return;
    markedRef.current.add(a.id);
    seen.mutate([a.id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id]);

  // Progress / auto-advance
  useEffect(() => {
    if (paused || waiting || reduce) return;
    const started = Date.now() - progress * SLIDE_MS;
    const t = setInterval(() => {
      const p = (Date.now() - started) / SLIDE_MS;
      if (p >= 1) {
        clearInterval(t);
        go(index + 1);
      } else setProgress(p);
    }, 50);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused, waiting, reduce]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
      if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    const onVis = () => setPaused(document.hidden);
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      document.body.style.overflow = overflow;
    };
  }, [go, index, onClose]);

  if (!a || typeof document === 'undefined') return null;
  const confirm = () =>
    ack.mutate(a.id, {
      onSuccess: () => {
        setAcked((s) => new Set(s).add(a.id));
        toast.success('Thanks — confirmed');
        setTimeout(() => go(index + 1), 600);
      },
      onError: (e) => toast.error(getApiErrorMessage(e, 'Could not confirm')),
    });

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-0 backdrop-blur-sm animate-in fade-in-0 sm:p-6" role="dialog" aria-modal aria-label="Catch up on announcements">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close"><X className="h-5 w-5" /></button>
      <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30 sm:block" aria-label="Previous"><ChevronLeft className="h-6 w-6" /></button>
      <button type="button" onClick={() => go(index + 1)} className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:block" aria-label="Next"><ChevronRight className="h-6 w-6" /></button>

      <div
        key={a.id}
        className="relative flex h-full w-full max-w-[440px] flex-col overflow-hidden bg-slate-950 text-white shadow-2xl animate-in fade-in-0 zoom-in-95 sm:h-[min(92vh,780px)] sm:rounded-[28px]"
        onPointerDown={(e) => {
          drag.current = e.clientX;
          setPaused(true);
        }}
        onPointerUp={(e) => {
          const dx = drag.current === null ? 0 : e.clientX - drag.current;
          drag.current = null;
          setPaused(false);
          if ((e.target as HTMLElement).closest('button,a')) return;
          if (Math.abs(dx) > 50) return go(index + (dx < 0 ? 1 : -1));
          const box = e.currentTarget.getBoundingClientRect();
          if (e.clientX - box.left < box.width / 3) go(index - 1);
          else go(index + 1);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setPaused(false);
        }}
      >
        {/* Progress */}
        <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
          {items.map((x, i) => (
            <span key={x.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <i className="block h-full bg-white" style={{ width: `${i < index ? 100 : i === index ? (waiting ? 100 : progress * 100) : 0}%`, opacity: i === index && waiting ? 0.6 : 1 }} />
            </span>
          ))}
        </div>
        <div className="absolute inset-x-3 top-7 z-20 flex items-center gap-2 text-xs">
          {a.author && <PersonAvatar person={a.author} size="xs" />}
          <b>{a.author ? `${a.author.firstName} ${a.author.lastName}` : 'HR'}</b>
          <span className="opacity-70">{formatRelative(a.publishedAt)}</span>
          <button type="button" onClick={() => setPaused((p) => !p)} className="ml-auto rounded-full p-1 hover:bg-white/15" aria-label={paused ? 'Play' : 'Pause'}>{paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>
        </div>

        <AnnouncementCover a={a} size="banner" className="h-[46%] shrink-0" burst />

        <div className="relative flex min-h-0 flex-1 flex-col gap-3 bg-gradient-to-b from-slate-900 to-slate-950 p-5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-full bg-white/15 px-2 py-0.5 font-semibold">{CATEGORIES[a.category]?.emoji} {CATEGORIES[a.category]?.label}</span>
            <span className="opacity-70">{index + 1} of {items.length} · {readTime(a.body)}</span>
          </div>
          <h2 className="text-2xl font-bold leading-tight">{a.title}</h2>
          {a.eventAt && <p className="text-sm font-semibold text-amber-300">📅 {eventWhen(a.eventAt)}{a.eventPlace ? ` · ${a.eventPlace}` : ''}</p>}
          <p className="min-h-0 flex-1 overflow-y-auto whitespace-pre-line text-[15px] leading-relaxed text-white/85">{plain(a.body)}</p>
          <div className="flex items-center gap-2">
            {waiting ? (
              <button type="button" onClick={confirm} disabled={ack.isPending} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-slate-900 disabled:opacity-60">
                <CheckCircle2 className="h-5 w-5" /> I have read this
              </button>
            ) : (
              <Link href={`/app/announcements/${a.id}`} onClick={onClose} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white/12 bg-white/10 font-semibold hover:bg-white/20">
                <ExternalLink className="h-4 w-4" /> Open the full post
              </Link>
            )}
            {a.allowReactions &&
              ['👍', '❤️', '🎉'].map((e) => {
                const mine = a.reactions.find((r) => r.emoji === e)?.mine;
                return (
                  <button key={e} type="button" onClick={() => react.mutate({ id: a.id, emoji: e })} aria-pressed={Boolean(mine)} className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-lg transition-transform active:scale-90', mine ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20')}>
                    {e}
                  </button>
                );
              })}
          </div>
          {waiting && <p className="text-center text-xs text-white/60">HR asked everyone to confirm this one — it waits for you.</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
