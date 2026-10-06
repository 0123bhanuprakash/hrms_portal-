'use client';

import React, { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useCompanyTheme, usePreferences } from '@/lib/company/queries';
import { effectiveBackdrop, moodForPath, type BackdropMood } from '@/lib/preferences/backdrop';
import { cn } from '@/lib/cn';
import type { BackdropPack } from '@hrms/types';
import { PackLayers } from './backdrop-packs';

// ============================================================
// The living background behind every page (styles: app/backdrops.css,
// Terra/Prism packs: backdrop-packs.tsx + app/backdrop-packs.css).
// Sits behind the main column; sidebar, top bar and content are
// untouched. Only transform/opacity animate; paused while the tab
// is hidden; "Calm" freezes it, "Off" and the Simple pack remove it.
// ============================================================

/** Deterministic pseudo-random numbers, so the server and client render the same. */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function scatter(n: number, seed: number, cls: string | ((i: number) => string), dur: [number, number], extra?: (r: () => number) => React.CSSProperties, child?: (i: number) => React.ReactNode) {
  const r = seeded(seed);
  return Array.from({ length: n }, (_, i) => (
    <i
      key={i}
      className={typeof cls === 'string' ? cls : cls(i)}
      style={{
        left: `${(r() * 100).toFixed(1)}%`,
        animationDuration: `${(dur[0] + r() * (dur[1] - dur[0])).toFixed(1)}s`,
        animationDelay: `-${(r() * dur[1]).toFixed(1)}s`,
        ...extra?.(r),
      }}
    >
      {child?.(i)}
    </i>
  ));
}

const wave = (amp: number, y: number, k: number) => {
  let d = `M0 ${y}`;
  for (let x = 0; x <= 1600; x += 20) d += ` L${x} ${(y + Math.sin((x / 1600) * Math.PI * 2 * k) * amp).toFixed(1)}`;
  return d;
};

const PULSE = 'M0 80 L300 80 L330 80 L345 40 L360 110 L375 60 L390 80 L700 80 L720 80 L732 55 L745 100 L758 80 L1000 80';

function Aurora() {
  return (
    <>
      <div className="bd-blob bd-b1" />
      <div className="bd-blob bd-b2" />
      <div className="bd-blob bd-b3" />
    </>
  );
}

function Layers({ mood }: { mood: BackdropMood }) {
  switch (mood) {
    case 'aurora':
      return <Aurora />;
    case 'constellation':
      return (
        <>
          <div className="bd-halo" />
          {scatter(26, 7, 'bd-pt', [16, 30], (r) => { const px = +(2.5 + r() * 3).toFixed(1); return { width: px, height: px }; })}
        </>
      );
    case 'sweep':
      return (
        <>
          <div className="bd-dial" />
          <div className="bd-dial2" />
          <div className="bd-sweep" />
        </>
      );
    case 'horizon':
      return (
        <>
          <div className="bd-hz1" />
          <div className="bd-hz2" />
          <div className="bd-sun" />
        </>
      );
    case 'blueprint':
      return (
        <>
          <div className="bd-spot" />
          <div className="bd-grid" />
        </>
      );
    case 'mesh':
      return (
        <>
          <div className="bd-mesh" />
          {scatter(10, 31, 'bd-coin', [22, 36])}
        </>
      );
    case 'studio': {
      const r = seeded(5);
      return (
        <>
          <div className="bd-cone" />
          <div className="bd-floor" />
          {Array.from({ length: 9 }, (_, i) => {
            const s = 8 + r() * 26;
            return <i key={i} className="bd-bok" style={{ width: s, height: s, left: `${(r() * 95).toFixed(1)}%`, top: `${(r() * 90).toFixed(1)}%`, animationDuration: `${(8 + r() * 10).toFixed(1)}s` }} />;
          })}
        </>
      );
    }
    case 'rings':
      return (
        <>
          <div className="bd-core" />
          <div className="bd-rings"><i /><i /><i /></div>
        </>
      );
    case 'floaters': {
      const kinds = ['c', 'q', 'h', 'c', 'q'];
      return (
        <>
          <div className="bd-warm" />
          {scatter(16, 11, (i) => `bd-fl bd-fl-${kinds[i % 5]}`, [20, 36], undefined, (i) => (kinds[i % 5] === 'h' ? '♥' : null))}
        </>
      );
    }
    case 'waves':
      return (
        <>
          <svg className="bd-waves" viewBox="0 0 1600 220" preserveAspectRatio="none">
            <path d={wave(26, 120, 4)} className="bd-w-a" />
            <path d={wave(18, 150, 4)} className="bd-w-b" />
          </svg>
          <svg className="bd-waves bd-waves2" viewBox="0 0 1600 220" preserveAspectRatio="none">
            <path d={wave(34, 110, 2)} className="bd-w-c" />
          </svg>
        </>
      );
    case 'quiet':
      return (
        <>
          <div className="bd-qgrad" />
          <div className="bd-noise" />
        </>
      );
    case 'pulse': {
      const r = seeded(3);
      return (
        <>
          <div className="bd-night" />
          {Array.from({ length: 40 }, (_, i) => (
            <i key={i} className="bd-star" style={{ left: `${(r() * 100).toFixed(1)}%`, top: `${(r() * 60).toFixed(1)}%`, animationDuration: `${(3 + r() * 5).toFixed(1)}s` }} />
          ))}
          <svg className="bd-pulse" viewBox="0 0 1000 120" preserveAspectRatio="none">
            <path d={PULSE} className="bd-pulse-track" />
            <path d={PULSE} className="bd-pulse-run" />
          </svg>
        </>
      );
    }
    case 'hero':
      return (
        <div className="bd-big">
          <Aurora />
          {scatter(18, 19, 'bd-pt', [16, 30], (r) => { const px = +(2.5 + r() * 3).toFixed(1); return { width: px, height: px }; })}
        </div>
      );
    default:
      return null;
  }
}

/** Pauses every backdrop animation while the tab is in the background. */
function usePauseWhenHidden() {
  useEffect(() => {
    const sync = () => document.documentElement.toggleAttribute('data-page-hidden', document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
}

/** Pure background for a given pack, mood and level (sign-in pages, previews). */
export function Backdrop({
  mood,
  pack = 'signature',
  level = 'lively',
  timeZone,
  contained,
  className,
}: {
  mood: BackdropMood;
  pack?: BackdropPack;
  level?: 'lively' | 'calm' | 'off';
  timeZone?: string;
  contained?: boolean;
  className?: string;
}) {
  usePauseWhenHidden();
  if (level === 'off' || pack === 'simple') return null;
  return (
    <div className={cn('bd-root', contained && 'bd-contained', className)} data-pack={pack} data-mood={mood} data-level={level} aria-hidden>
      <div className="bd-base" />
      <div key={`${pack}-${mood}`} className="bd-layer">
        {pack === 'terra' || pack === 'prism' ? <PackLayers pack={pack} mood={mood} level={level} timeZone={timeZone} /> : <Layers mood={mood} />}
      </div>
      <div className="bd-vig" />
    </div>
  );
}

/** The signed-in portals: mood from the route, pack and level from the person or their company. */
export function PageBackdrop({ platform = false }: { platform?: boolean }) {
  const pathname = usePathname();
  const companyId = useAuthStore((s) => s.companyId);
  const theme = useCompanyTheme(platform ? null : companyId);
  const prefs = usePreferences();
  const { pack, level } = useMemo(() => effectiveBackdrop(prefs.data, theme.data?.personalization), [prefs.data, theme.data]);
  if (!prefs.data) return null;
  return <Backdrop mood={moodForPath(pathname)} pack={pack} level={level} timeZone={prefs.data.timezone} />;
}
