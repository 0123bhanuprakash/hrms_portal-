'use client';

import React, { useId, useMemo } from 'react';
import type { ThemeTokens } from '@hrms/types';
import { mix } from '@/lib/theme/color';
import { cn } from '@/lib/cn';

// ============================================================
// Generative cover art for a theme: blurred "mesh gradient" blobs
// in the theme's own colors + a film-grain overlay, rendered as SVG.
// Deterministic per seed (same theme → same image), no network,
// crisp at any size, and always on-brand.
// ============================================================

/** Small deterministic PRNG (mulberry32) seeded from a string. */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ThemeArt({
  tokens,
  seed,
  mode = 'light',
  className,
  children,
}: {
  tokens: ThemeTokens;
  /** Stable key (e.g. preset key or theme id) so the artwork never jumps around */
  seed: string;
  mode?: 'light' | 'dark';
  className?: string;
  children?: React.ReactNode;
}) {
  const uid = useId().replace(/:/g, '');
  const p = mode === 'dark' ? tokens.dark : tokens.light;

  const art = useMemo(() => {
    const rand = seededRandom(seed);
    const base = mode === 'dark' ? mix(p.background, p.primary, 0.12) : mix('#FFFFFF', p.primary, 0.1);
    const palette = [
      p.primary,
      mix(p.primary, p.info, 0.55),
      mix(p.primary, '#FFFFFF', mode === 'dark' ? 0.15 : 0.45),
      p.sidebar === p.surface ? mix(p.primary, p.success, 0.4) : p.sidebar,
      mix(p.primary, p.warning, 0.35),
    ];
    const blobs = palette.map((color, i) => ({
      color,
      cx: 40 + rand() * 320,
      cy: 20 + rand() * 200,
      r: 70 + rand() * 90 - i * 6,
      opacity: 0.55 + rand() * 0.35,
    }));
    const arcs = Array.from({ length: 3 }, () => ({
      cx: rand() * 400,
      cy: rand() * 240,
      r: 60 + rand() * 140,
    }));
    return { base, blobs, arcs };
  }, [seed, mode, p]);

  return (
    <div className={cn('relative isolate overflow-hidden', className)}>
      <svg
        className="absolute inset-0 -z-10 h-full w-full"
        viewBox="0 0 400 240"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <filter id={`blur-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="38" />
          </filter>
          <filter id={`grain-${uid}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="table" tableValues="0 0.09" />
            </feComponentTransfer>
          </filter>
          <linearGradient id={`sheen-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity={mode === 'dark' ? 0.06 : 0.35} />
            <stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width="400" height="240" fill={art.base} />
        <g filter={`url(#blur-${uid})`}>
          {art.blobs.map((b, i) => (
            <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={b.color} opacity={b.opacity} />
          ))}
        </g>
        {/* Fine contour arcs for a crafted, editorial feel */}
        <g fill="none" stroke="#FFFFFF" strokeOpacity={mode === 'dark' ? 0.06 : 0.18} strokeWidth="0.75">
          {art.arcs.map((a, i) => (
            <circle key={i} cx={a.cx} cy={a.cy} r={a.r} />
          ))}
        </g>
        <rect width="400" height="240" fill={`url(#sheen-${uid})`} />
        <rect width="400" height="240" filter={`url(#grain-${uid})`} />
      </svg>
      {children}
    </div>
  );
}
