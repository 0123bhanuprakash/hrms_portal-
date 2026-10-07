'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

// ============================================================
// Small motion helpers. CSS does the animating (app/motion.css);
// these only decide when. Everything respects "Reduce motion".
// ============================================================

/** True when the device or the person's Preferences ask for less motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const read = () => setReduced(mq.matches || document.documentElement.getAttribute('data-motion') === 'reduce');
    read();
    mq.addEventListener('change', read);
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    return () => {
      mq.removeEventListener('change', read);
      obs.disconnect();
    };
  }, []);
  return reduced;
}

/** Chart parts that animate in (app/motion.css → "Charts"). */
const CHART_PARTS = '.m-fill-w, .m-grow-y, .m-draw, .m-sweep, .m-line, .m-fade, .m-dotpop, .m-legend > *, .m-cell, .tm-ring, .m-milestone > *';

/** Calls back once, the first time the element is (about to be) on screen. */
function onFirstSight(el: Element, seen: () => void) {
  if (typeof IntersectionObserver === 'undefined') {
    seen();
    return () => undefined;
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        seen();
      }
    },
    { rootMargin: '0px 0px -40px 0px' },
  );
  io.observe(el);
  return () => io.disconnect();
}

/**
 * Marks <html data-hidden> while the tab is hidden, so CSS loops pause; and
 * holds every chart animation (bars, rings, lines…) until that chart first
 * scrolls into view, so it plays where you can see it — once.
 */
export function MotionVisibility() {
  useEffect(() => {
    const sync = () => document.documentElement.toggleAttribute('data-hidden', document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.removeAttribute('data-wait');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -40px 0px' },
    );
    const known = new WeakSet<Element>();
    const hold = (el: Element) => {
      if (known.has(el)) return;
      known.add(el);
      el.setAttribute('data-wait', '');
      io.observe(el);
    };
    const scan = (root: Element) => {
      if (root.matches(CHART_PARTS)) hold(root);
      root.querySelectorAll(CHART_PARTS).forEach(hold);
    };
    scan(document.body);
    // Runs before the browser paints new nodes, so nothing starts early
    const mo = new MutationObserver((list) => {
      for (const m of list) m.addedNodes.forEach((n) => n instanceof Element && scan(n));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);
  return null;
}

/** Renders its children only once this spot first comes into view (for charts that animate on mount). */
export function WhenSeen({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => (ref.current ? onFirstSight(ref.current, () => setSeen(true)) : undefined), []);
  return (
    <div ref={ref} className={className} style={style}>
      {seen ? children : null}
    </div>
  );
}

/** A number that rolls up to its value (screen readers get the final value). */
export function CountUp({ value, format = (n) => String(Math.round(n)), duration = 900, className }: { value: number; format?: (n: number) => string; duration?: number; className?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(0);
  const ref = useRef<HTMLSpanElement>(null);
  // Count only once the number is on screen
  const [seen, setSeen] = useState(false);
  useEffect(() => (ref.current ? onFirstSight(ref.current, () => setSeen(true)) : undefined), []);
  useEffect(() => {
    if (!seen && !reduced) return;
    if (reduced) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced, seen]);
  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      <span aria-hidden>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}

const BURST_TONES = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--info))', 'hsl(var(--destructive))'];

/** Confetti burst from the centre of its parent (parent needs `relative`). Re-fires when `fire` changes. */
export function Burst({ fire, count = 16, spread = 110 }: { fire: number; count?: number; spread?: number }) {
  const reduced = useReducedMotion();
  if (!fire || reduced) return null;
  return (
    <span key={fire} className="m-burst" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        const r = spread * (0.6 + ((i * 37) % 10) / 25);
        return <i key={i} style={{ background: BURST_TONES[i % BURST_TONES.length], ['--x' as string]: `${Math.round(Math.cos(a) * r)}px`, ['--y' as string]: `${Math.round(Math.sin(a) * r * 0.7)}px` }} />;
      })}
    </span>
  );
}

/** Gentle confetti falling inside a card (decorative). */
export function Confetti({ count = 14 }: { count?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <span className="m-confetti" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: BURST_TONES[i % BURST_TONES.length], animationDelay: `${((i * 0.73) % 7).toFixed(2)}s`, animationDuration: `${6 + (i % 4)}s` }} />
      ))}
    </span>
  );
}

/** Ring then tick, drawn in — for toasts and "done" moments. */
export function SuccessTick({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg className={cn('m-tick shrink-0 text-success', className)} width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M9 14.5l3.5 3.5L19 11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Progress bar whose milestones light up as they're passed. */
export function Milestones({ percent, steps = [33, 66, 100], label }: { percent: number; steps?: number[]; label: string }) {
  return (
    <div className="m-milestone mr-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={label}>
      <i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      {steps.map((s, i) => (
        <b key={s} data-on={percent >= s ? '' : undefined} style={{ left: `${s}%`, animationDelay: `${0.5 + i * 0.35}s` }} />
      ))}
    </div>
  );
}

/** The chosen days, filling in one after another (Apply leave / WFH). */
export function RangeSweep({ from, to, isOff }: { from: string; to: string; isOff?: (iso: string) => boolean }) {
  if (!from || !to || to < from) return null;
  const days: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end && days.length < 62) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'narrow', timeZone: 'UTC' });
  return (
    <div key={`${from}-${to}`} className="m-sweep flex flex-wrap gap-1" aria-hidden>
      {days.map((iso, i) => {
        const off = isOff?.(iso);
        return (
          <span
            key={iso}
            title={iso}
            style={{ animationDelay: `${Math.min(i, 20) * 60}ms` }}
            className={cn('flex h-8 w-8 flex-col items-center justify-center rounded-md text-[10px] font-semibold leading-tight', off ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground')}
          >
            <span>{fmt.format(new Date(`${iso}T00:00:00Z`))}</span>
            <span className="text-xs">{Number(iso.slice(8))}</span>
          </span>
        );
      })}
    </div>
  );
}

/** Words of a heading rising in — only on the first visit of the day. */
export function RevealWords({ text, storageKey, className }: { text: string; storageKey: string; className?: string }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const today = new Date().toDateString();
    try {
      if (localStorage.getItem(storageKey) !== today) {
        setAnimate(true);
        localStorage.setItem(storageKey, today);
      }
    } catch {
      /* storage unavailable: skip the reveal */
    }
  }, [storageKey]);
  if (!animate) return <span className={className}>{text}</span>;
  return (
    <span className={cn('m-words', className)} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <React.Fragment key={i}>
          <span aria-hidden>{w}</span>{' '}
        </React.Fragment>
      ))}
    </span>
  );
}

type DayPart = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
function skyNow(d = new Date()): { part: DayPart; x: number; y: number; moon: boolean } {
  const h = d.getHours() + d.getMinutes() / 60;
  const part: DayPart = h >= 5 && h < 7 ? 'dawn' : h >= 7 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 19.5 ? 'evening' : 'night';
  const moon = part === 'night';
  // Sun 06:00 → 19:00 across the sky; moon 19:00 → 06:00
  const p = moon ? ((h >= 19 ? h - 19 : h + 5) / 11) : Math.max(0, Math.min(1, (h - 6) / 13));
  const x = 50 + p * 46;
  const y = 82 - Math.sin(p * Math.PI) * 62;
  return { part, x, y, moon };
}

/** Hero card: sky by time of day, pointer spotlight, theme accent glow. */
export function SkyHero({ className, children, skyPart, decoration }: { className?: string; children: React.ReactNode; skyPart?: string; decoration?: React.ReactNode }) {
  const [sky, setSky] = useState(() => skyNow());
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const t = setInterval(() => setSky(skyNow()), 5 * 60_000);
    return () => clearInterval(t);
  }, []);
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--mx', `${e.clientX - r.left}px`);
    ref.current.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <section ref={ref} onPointerMove={onMove} className={cn('m-hero rounded-xl border border-white/10 shadow-card', className)}>
      <div className="m-sky" data-part={skyPart === 'night' ? 'night' : skyPart ?? sky.part} aria-hidden>
        {sky.moon || skyPart === 'night'
          ? Array.from({ length: 18 }, (_, i) => <span key={i} className="m-star" style={{ left: `${(i * 53) % 100}%`, top: `${(i * 29) % 70}%`, animationDelay: `${(i % 6) * 0.5}s` }} />)
          : [0, 1].map((i) => <span key={i} className="m-cloud" style={{ top: `${22 + i * 30}%`, width: `${60 + i * 20}px`, left: `${50 + i * 20}%`, animationDelay: `${-i * 25}s` }} />)}
        <span className="m-sun" data-moon={sky.moon || skyPart === 'night' ? '' : undefined} style={{ ['--sun-x' as string]: `${sky.x}%`, ['--sun-y' as string]: `${sky.y}%` }} />
        <span className="m-hills" />
      </div>
      {decoration}
      {children}
    </section>
  );
}

/** Wraps an icon / emoji; when `fire` changes it beats and throws small hearts. */
export function HeartBurst({ fire, children }: { fire: number; children: React.ReactNode }) {
  return (
    <span key={fire} className="m-heart" data-burst={fire ? '' : undefined}>
      {children}
      {fire > 0 &&
        Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return <i key={i} aria-hidden style={{ ['--x' as string]: `${Math.round(Math.cos(a) * 16)}px`, ['--y' as string]: `${Math.round(Math.sin(a) * 16)}px` }} />;
        })}
    </span>
  );
}

/**
 * A list that scrolls itself slowly and loops. Put the items in twice inside
 * `children` (the second copy aria-hidden). While the pointer is over it, or it
 * has keyboard focus, it stops and the person can scroll it themselves (wheel,
 * trackpad, swipe); it carries on from there afterwards. Scrolling past either
 * end wraps round, so the list never runs out.
 */
export function Ticker({ seconds, label, className, children }: { seconds: number; label: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let hover = false;
    let focus = false;
    let touchUntil = 0;
    let pos = el.scrollTop;
    let last = 0;
    let frame = 0;
    const half = () => el.scrollHeight / 2;
    // Keep the view inside the first copy so both directions loop
    const wrap = () => {
      const h = half();
      if (h <= el.clientHeight) return;
      if (el.scrollTop >= h) el.scrollTop -= h;
      else if (el.scrollTop <= 0 && (hover || focus || touchUntil)) el.scrollTop += h;
      pos = el.scrollTop;
    };
    const tick = (t: number) => {
      const dt = last ? Math.min(t - last, 100) : 0;
      last = t;
      const idle = !hover && !focus && Date.now() > touchUntil && !document.hidden;
      if (idle) {
        // A person scrolled meanwhile → continue from where they left it
        if (Math.abs(el.scrollTop - pos) > 1) pos = el.scrollTop;
        pos += (half() / (seconds * 1000)) * dt;
        el.scrollTop = pos;
        if (pos >= half()) wrap();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const on = (type: string, fn: () => void) => {
      el.addEventListener(type, fn, { passive: true });
      return () => el.removeEventListener(type, fn);
    };
    const offs = [
      on('pointerenter', () => { hover = true; }),
      on('pointerleave', () => { hover = false; pos = el.scrollTop; }),
      on('focusin', () => { focus = true; }),
      on('focusout', () => { focus = false; pos = el.scrollTop; }),
      on('touchstart', () => { touchUntil = Number.MAX_SAFE_INTEGER; }),
      on('touchend', () => { touchUntil = Date.now() + 3000; }),
      on('scroll', () => { if (hover || focus || touchUntil > Date.now()) wrap(); }),
      // Already at the very top: no scroll event fires, so jump to the end first
      on('wheel', () => { if (el.scrollTop <= 0) { el.scrollTop += half(); pos = el.scrollTop; } }),
    ];
    return () => {
      cancelAnimationFrame(frame);
      offs.forEach((off) => off());
    };
  }, [seconds]);
  return (
    <div ref={ref} className={cn('m-ticker', className)} tabIndex={0} aria-label={label}>
      {children}
    </div>
  );
}
