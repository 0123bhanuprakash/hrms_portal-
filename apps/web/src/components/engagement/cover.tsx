'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Announcement } from '@/lib/company/engagement';
import { cn } from '@/lib/cn';
import { Art3D, suggestArt } from './art-3d';
import { COVERS, CATEGORIES } from './announcement-ui';

// ============================================================
// Announcement covers: a colour, an uploaded image / GIF / video /
// Lottie, an animated scene, and floating 3D art — layered.
// Motion: off (still), gentle (loops), lively (+ a burst when opened).
// ============================================================

export const SCENES = ['confetti', 'diyas', 'sparkles', 'aurora', 'snow', 'balloons', 'fireworks', 'rain'] as const;
export type Scene = (typeof SCENES)[number];
export const SCENE_LABELS: Record<Scene, string> = { confetti: 'Confetti', diyas: 'Diyas', sparkles: 'Sparkles', aurora: 'Aurora', snow: 'Snow', balloons: 'Balloons', fireworks: 'Fireworks', rain: 'Rain' };
/** A fitting background for each scene (used when the poster picks a scene) */
export const SCENE_BG: Record<Scene, string> = {
  confetti: 'from-violet-600 via-fuchsia-600 to-pink-500',
  diyas: 'from-indigo-950 via-purple-900 to-orange-800',
  sparkles: 'from-slate-900 via-indigo-900 to-indigo-700',
  aurora: 'from-slate-950 via-slate-900 to-slate-800',
  snow: 'from-blue-900 via-blue-700 to-sky-400',
  balloons: 'from-pink-200 via-rose-200 to-amber-100',
  fireworks: 'from-slate-950 via-indigo-950 to-violet-900',
  rain: 'from-slate-700 via-slate-600 to-sky-700',
};

export type CoverData = Pick<Announcement, 'category' | 'title' | 'cover' | 'coverEmoji' | 'coverScene' | 'coverArt' | 'coverMotion' | 'coverMediaUrl' | 'coverMediaKind' | 'coverFocusX' | 'coverFocusY' | 'coverDim'>;
type Size = 'hero' | 'banner' | 'tile' | 'thumb';

const COLORS = ['#FDE047', '#F472B6', '#60A5FA', '#34D399', '#FB923C', '#A78BFA', '#F87171'];
/** Deterministic pseudo-random so a cover looks the same on every render */
const rnd = (i: number, salt = 1) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export function CoverScene({ scene, size = 'hero', still }: { scene: Scene; size?: Size; still?: boolean }) {
  const n = size === 'thumb' ? 6 : size === 'tile' ? 10 : 22;
  const h = size === 'thumb' ? 90 : size === 'tile' ? 140 : 340;
  const items = useMemo(() => Array.from({ length: n }, (_, i) => i), [n]);
  const base = cn('sc', `sc-${scene}`, still && 'sc-still');
  const style = { ['--h' as string]: `${h}px` } as React.CSSProperties;
  if (scene === 'aurora') return <div className={base} style={style} aria-hidden><i /></div>;
  if (scene === 'diyas') {
    const count = size === 'thumb' ? 2 : size === 'tile' ? 3 : 5;
    return (
      <div className={base} style={style} aria-hidden>
        {Array.from({ length: count }, (_, i) => <i key={`d${i}`} className="d" style={{ left: `${(100 / (count + 1)) * (i + 1) - 4}%`, transform: `scale(${size === 'thumb' ? 0.6 : 1})` }} />)}
        <div className="sc sc-sparkles">{items.slice(0, Math.ceil(n / 2)).map((i) => <i key={i} style={{ left: `${rnd(i) * 96}%`, top: `${rnd(i, 2) * 55}%`, animationDuration: `${1.6 + rnd(i, 3) * 2}s`, animationDelay: `${rnd(i, 4) * 2}s` }} />)}</div>
      </div>
    );
  }
  if (scene === 'fireworks') {
    const bursts = size === 'thumb' ? 1 : size === 'tile' ? 2 : 4;
    return (
      <div className={base} style={style} aria-hidden>
        {Array.from({ length: bursts }, (_, b) => (
          <i key={b} className="f" style={{ left: `${18 + rnd(b, 5) * 64}%`, top: `${15 + rnd(b, 6) * 40}%` }}>
            {Array.from({ length: 12 }, (_, k) => (
              <b key={k} style={{ ['--a' as string]: `${k * 30}deg`, ['--d' as string]: `${size === 'hero' || size === 'banner' ? 52 : 26}px`, background: COLORS[(b + k) % COLORS.length], animationDelay: `${b * 0.6}s` } as React.CSSProperties} />
            ))}
          </i>
        ))}
        <div className="sc sc-sparkles">{items.slice(0, 8).map((i) => <i key={i} style={{ left: `${rnd(i) * 96}%`, top: `${rnd(i, 2) * 90}%`, animationDuration: `${2 + rnd(i, 3) * 2}s`, animationDelay: `${rnd(i, 4) * 2}s` }} />)}</div>
      </div>
    );
  }
  return (
    <div className={base} style={style} aria-hidden>
      {items.map((i) => {
        const left = `${rnd(i) * 100}%`;
        const delay = `${-rnd(i, 2) * 6}s`;
        if (scene === 'confetti') return <i key={i} style={{ left, background: COLORS[i % COLORS.length], animationDuration: `${3 + rnd(i, 3) * 3}s`, animationDelay: delay, ['--r' as string]: `${360 + rnd(i, 4) * 540}deg` } as React.CSSProperties} />;
        if (scene === 'snow') {
          const s = 3 + rnd(i, 3) * 5;
          return <i key={i} style={{ left, width: s, height: s, animationDuration: `${5 + rnd(i, 4) * 5}s`, animationDelay: delay, ['--dx' as string]: `${-20 + rnd(i, 5) * 40}px` } as React.CSSProperties} />;
        }
        if (scene === 'rain') return <i key={i} style={{ left: `${rnd(i) * 120}%`, animationDuration: `${0.7 + rnd(i, 3) * 0.6}s`, animationDelay: delay }} />;
        if (scene === 'sparkles') return <i key={i} style={{ left, top: `${rnd(i, 5) * 92}%`, animationDuration: `${1.6 + rnd(i, 3) * 2.4}s`, animationDelay: `${rnd(i, 4) * 3}s` }} />;
        if (scene === 'balloons') {
          if (i >= (size === 'thumb' ? 3 : size === 'tile' ? 4 : 8)) return null;
          return <i key={i} style={{ left: `${6 + rnd(i) * 86}%`, background: COLORS[i % COLORS.length], animationDuration: `${7 + rnd(i, 3) * 6}s`, animationDelay: `${-rnd(i, 2) * 10}s`, transform: `scale(${size === 'thumb' ? 0.5 : 1})` }} />;
        }
        return null;
      })}
    </div>
  );
}

/** Lottie animation from a URL (the player is loaded only when needed). */
function LottieCover({ url, still }: { url: string; still?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let anim: { destroy: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const [{ default: lottie }, data] = await Promise.all([import('lottie-web/build/player/lottie_light'), fetch(url).then((r) => r.json())]);
        if (cancelled || !box.current) return;
        anim = lottie.loadAnimation({ container: box.current, renderer: 'svg', loop: true, autoplay: !still, animationData: data, rendererSettings: { preserveAspectRatio: 'xMidYMid slice' } });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [url, still]);
  if (failed) return null;
  return <div ref={box} className="absolute inset-0 [&>svg]:!h-full [&>svg]:!w-full" aria-hidden />;
}

/** True when the device or the user's preference asks for less motion. */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduce(mq.matches || document.documentElement.dataset.motion === 'reduce');
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduce;
}

const ART_SIZE: Record<Size, string> = { hero: 'h-32 w-32 sm:h-40 sm:w-40', banner: 'h-36 w-36 sm:h-44 sm:w-44', tile: 'h-16 w-16', thumb: 'h-11 w-11' };

/**
 * The full cover. `children` are drawn on top (title, badges).
 * `burst` plays the "lively" one-time confetti burst (when a post is opened).
 */
export function AnnouncementCover({ a, size, className, children, burst, artPlacement = size === 'hero' ? 'right' : 'center' }: { a: CoverData; size: Size; className?: string; children?: React.ReactNode; burst?: boolean; artPlacement?: 'right' | 'center' }) {
  const reduce = useReducedMotion();
  const still = reduce || a.coverMotion === 'off';
  const scene = (SCENES as readonly string[]).includes(a.coverScene ?? '') ? (a.coverScene as Scene) : null;
  const media = a.coverMediaUrl ? a.coverMediaKind : null;
  const gradient = scene && !a.cover ? SCENE_BG[scene] : COVERS[a.cover ?? CATEGORIES[a.category]?.cover ?? 'indigo'];
  // Art: the chosen piece; an emoji the poster picked; else a suggestion — unless an upload fills the cover
  const art = a.coverArt ?? (a.coverEmoji || media ? null : suggestArt(a.category, a.title));
  const position = `${a.coverFocusX ?? 50}% ${a.coverFocusY ?? 50}%`;
  const [showBurst, setShowBurst] = useState(false);
  useEffect(() => {
    if (!burst || still || a.coverMotion !== 'lively') return;
    setShowBurst(true);
    const t = setTimeout(() => setShowBurst(false), 1800);
    return () => clearTimeout(t);
  }, [burst, still, a.coverMotion]);

  return (
    <div className={cn('relative isolate overflow-hidden bg-gradient-to-br', gradient, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- uploaded covers (incl. GIFs) come from storage URLs */}
      {media === 'image' && <img src={a.coverMediaUrl!} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position }} />}
      {media === 'video' && (
        <video src={a.coverMediaUrl!} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position }} muted loop playsInline autoPlay={!still} preload="metadata" aria-hidden />
      )}
      {media === 'lottie' && <LottieCover url={a.coverMediaUrl!} still={still} />}
      {media && size !== 'thumb' && <div className="absolute inset-0 bg-black" style={{ opacity: (a.coverDim ?? 25) / 100 }} />}
      {!media && <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(255,255,255,.28),transparent_50%)]" />}
      {scene && <CoverScene scene={scene} size={size} still={still} />}
      {showBurst && (
        <div className="sc sc-burst" aria-hidden>
          {Array.from({ length: 28 }, (_, i) => (
            <i key={i} style={{ background: COLORS[i % COLORS.length], ['--x' as string]: `${Math.cos((i / 28) * Math.PI * 2) * (120 + rnd(i) * 140)}px`, ['--y' as string]: `${Math.sin((i / 28) * Math.PI * 2) * (70 + rnd(i, 2) * 90)}px` } as React.CSSProperties} />
          ))}
        </div>
      )}
      {(art || (a.coverEmoji && !media)) && (
        <div className={cn('pointer-events-none absolute', artPlacement === 'right' ? 'right-4 top-1/2 -translate-y-1/2 sm:right-8' : 'inset-0 flex items-center justify-center')}>
          {art ? <Art3D name={art} float={!still} className={ART_SIZE[size]} /> : <span className={cn('drop-shadow-lg', size === 'thumb' ? 'text-2xl' : size === 'tile' ? 'text-4xl' : 'text-7xl')}>{a.coverEmoji}</span>}
        </div>
      )}
      {children && <div className="relative h-full">{children}</div>}
    </div>
  );
}
