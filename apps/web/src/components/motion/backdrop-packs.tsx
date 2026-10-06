'use client';

import React, { useEffect, useId, useState } from 'react';
import type { BackdropMood } from '@/lib/preferences/backdrop';

// ============================================================
// Terra (nature) and Prism (geometry) background packs.
// Same section moods as Signature, completely new look.
// Styles: app/backdrop-packs.css (.bdt-* Terra, .bdp-* Prism).
// Board designs: docs/design/builders/build-packs.js.
// ============================================================

type Level = 'lively' | 'calm';

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const f1 = (n: number) => n.toFixed(1);

/** A wavy profile that repeats every `tile` units, so a 2-tile strip loops seamlessly. */
function ridge(tile: number, base: number, amps: Array<[number, number]>, seed: number) {
  const r = seeded(seed);
  const ph = amps.map(() => r() * Math.PI * 2);
  const y = (x: number) => base - amps.reduce((s, [a, k], i) => s + a * Math.sin((x / tile) * Math.PI * 2 * k + (ph[i] ?? 0)), 0);
  let d = `M0 ${f1(y(0))}`;
  for (let x = 10; x <= tile * 2; x += 10) d += ` L${x} ${f1(y(x))}`;
  return d;
}

/** A closed, gently wobbly ring — one contour line. */
function contour(cx: number, cy: number, R: number, wob: number, seed: number) {
  const r = seeded(seed);
  const [p0, p1, p2] = [r() * 6, r() * 6, r() * 6];
  let d = '';
  for (let i = 0; i <= 72; i++) {
    const t = (i / 72) * Math.PI * 2;
    const rr = R * (1 + wob * (0.55 * Math.sin(3 * t + p0) + 0.3 * Math.sin(5 * t + p1) + 0.15 * Math.sin(2 * t + p2)));
    d += `${i ? 'L' : 'M'}${f1(cx + Math.cos(t) * rr)} ${f1(cy + Math.sin(t) * rr * 0.78)}`;
  }
  return `${d}Z`;
}

/** Minutes since midnight in the person's time zone; null until mounted (server render). */
function useClock(timeZone?: string) {
  const [min, setMin] = useState<number | null>(null);
  useEffect(() => {
    const read = () => {
      let h = new Date().getHours();
      let m = new Date().getMinutes();
      try {
        const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
        h = Number(parts.find((p) => p.type === 'hour')?.value ?? h);
        m = Number(parts.find((p) => p.type === 'minute')?.value ?? m);
      } catch {
        /* unknown zone → browser time */
      }
      setMin(h * 60 + m);
    };
    read();
    const t = setInterval(read, 60_000);
    return () => clearInterval(t);
  }, [timeZone]);
  return min;
}

// Sky phases through the day: [hour, dawn, day, dusk, night]; values in between blend.
const SKY: Array<[number, number, number, number, number]> = [
  [0, 0, 0, 0, 1], [4.5, 0, 0, 0, 1], [6, 1, 0, 0, 0], [8, 1, 0, 0, 0], [9.5, 0, 1, 0, 0],
  [16, 0, 1, 0, 0], [17.75, 0, 0, 1, 0], [18.75, 0, 0, 1, 0], [20, 0, 0, 0, 1], [24, 0, 0, 0, 1],
];
function skyAt(hour: number) {
  const i = Math.max(0, SKY.findIndex(([h], k) => hour >= h && hour < (SKY[k + 1]?.[0] ?? 25)));
  const [h0, ...a] = SKY[i] ?? SKY[0]!;
  const [h1, ...b] = SKY[Math.min(i + 1, SKY.length - 1)] ?? SKY[0]!;
  const t = h1 === h0 ? 0 : (hour - h0) / (h1 - h0);
  return a.map((v, k) => v + ((b[k] ?? v) - v) * t);
}

function Fireflies({ n, seed, top = [30, 94] }: { n: number; seed: number; top?: [number, number] }) {
  const r = seeded(seed);
  const v = () => `${((r() - 0.5) * 160).toFixed(0)}px`;
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <i
          key={i}
          className="bdt-ff"
          style={
            {
              left: `${f1(r() * 98)}%`,
              top: `${f1(top[0] + r() * (top[1] - top[0]))}%`,
              '--x1': v(), '--y1': v(), '--x2': v(), '--y2': v(), '--x3': v(), '--y3': v(),
              '--d': `${f1(14 + r() * 14)}s`,
              '--b': `${f1(4 + r() * 5)}s`,
              animationDelay: `-${f1(r() * 20)}s, -${f1(r() * 8)}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

function Ridges({ layers, height, className = '' }: { layers: Array<{ base: number; amps: Array<[number, number]>; seed: number; dur: number; cls: string; line?: boolean; drop?: number }>; height: string; className?: string }) {
  return (
    <>
      {layers.map((l, i) => {
        const d = ridge(800, l.base, l.amps, l.seed);
        return (
          <svg key={i} className={`bdt-ridge ${className}`} viewBox="0 0 1600 220" preserveAspectRatio="none" style={{ height, bottom: `${l.drop ?? 0}px`, animationDuration: `${l.dur}s` }}>
            <path d={`${d} L1600 220 L0 220Z`} className={`bdt-rf ${l.cls}`} />
            {l.line && <path d={d} className="bdt-rl" />}
          </svg>
        );
      })}
    </>
  );
}

// Static shapes, worked out once
const TOPO_LINES = (() => {
  const out: Array<{ d: string; ix: boolean }> = [];
  ([[860, 220, 10, 3], [260, 600, 8, 8], [1080, 680, 6, 13]] as const).forEach(([cx, cy, n, s]) => {
    for (let i = 1; i <= n; i++) out.push({ d: contour(cx, cy, i * 34, 0.12 + i * 0.006, s + i), ix: i % 4 === 0 });
  });
  return out;
})();
const TOPO_ROUTE = 'M90 700 C 260 560, 380 640, 500 500 S 700 320, 860 220 S 1050 130, 1140 90';
const TOPO_PINS: Array<[number, number]> = [[90, 700], [500, 500], [860, 220], [1140, 90]];
const TOPO_REST: [number, number] = [860, 220];

const ZEN_STONES: Array<[number, number, number]> = [[900, 230, 46], [300, 560, 34], [1040, 620, 24]];
const ZEN_LINES = (() => {
  const out: string[] = [];
  for (let y = 10; y < 800; y += 16) {
    let d = `M0 ${y}`;
    for (let x = 0; x <= 1200; x += 30) d += ` L${x} ${f1(y + Math.sin(x * 0.009 + y * 0.03) * 3.5)}`;
    out.push(d);
  }
  return out;
})();

const FACETS = (() => {
  const r = seeded(29);
  const cw = 90, ch = 78, cols = ['#10b981', 'var(--bd-a3)', 'var(--bd-a1)', '#34d399'];
  const out: Array<{ pts: string; fill: string; live: boolean; d: string; delay: string }> = [];
  const fill = () => `color-mix(in srgb, ${cols[Math.floor(r() * 4)]} ${Math.round(4 + r() * 16)}%, transparent)`;
  for (let row = 0; row * ch < 800 + ch; row++) {
    for (let col = -1; col * cw < 1200 + cw; col++) {
      const x = col * cw + (row % 2 ? cw / 2 : 0), y = row * ch;
      for (const pts of [`${x},${y} ${x + cw},${y} ${x + cw / 2},${y + ch}`, `${x + cw / 2},${y + ch} ${x + cw},${y} ${x + cw * 1.5},${y + ch}`]) {
        out.push({ pts, fill: fill(), live: r() < 0.4, d: `${f1(8 + r() * 7)}s`, delay: `-${f1(r() * 10)}s` });
      }
    }
  }
  return out;
})();

// ─── Terra ───────────────────────────────────────────────────

function TerraSky({ timeZone }: { timeZone?: string }) {
  const min = useClock(timeZone);
  const hour = (min ?? 12 * 60) / 60;
  const [dawn, day, dusk, night] = skyAt(hour);
  const deg = ((hour - 6) / 24) * 360;
  const r = seeded(41);
  return (
    <>
      {min !== null && (
        <>
          <div className="bdt-ph bdt-dawn" style={{ opacity: dawn }} />
          <div className="bdt-ph bdt-day" style={{ opacity: day }} />
          <div className="bdt-ph bdt-dusk" style={{ opacity: dusk }} />
          <div className="bdt-ph bdt-night" style={{ opacity: night }} />
          <div className="bdt-wheel" style={{ transform: `rotate(${deg}deg)` }}>
            <i className="bdt-orb bdt-sun" />
            <i className="bdt-orb bdt-moon" />
          </div>
        </>
      )}
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} className="bdt-cloud" style={{ top: `${f1(3 + r() * 26)}%`, width: `${(110 + r() * 110).toFixed(0)}px`, animationDuration: `${(80 + r() * 60).toFixed(0)}s`, animationDelay: `-${(r() * 120).toFixed(0)}s` }} />
      ))}
    </>
  );
}

/** Shift 09:30–18:30: the sun walks the arc as the working day goes by. */
function TerraSunPath({ timeZone }: { timeZone?: string }) {
  const min = useClock(timeZone);
  const p = min === null ? 0.45 : Math.min(1, Math.max(0, (min - 570) / 540));
  const th = Math.PI * (1 - p);
  const x = 500 + 460 * Math.cos(th), y = 600 - 540 * Math.sin(th);
  const arc = 'M40 600 A460 540 0 0 1 960 600';
  return (
    <>
      <div className="bdt-band" />
      <div className="bdt-arcbox">
        <svg viewBox="0 0 1000 620" preserveAspectRatio="none">
          <path d={arc} className="bdt-arc-track" />
          {p > 0 && <path d={`M40 600 A460 540 0 0 1 ${f1(x)} ${f1(y)}`} className="bdt-arc-done" />}
        </svg>
        <span className="bdt-hr" style={{ left: '1%', top: '100%' }}>09:30</span>
        <span className="bdt-hr" style={{ right: '1%', top: '100%' }}>18:30</span>
        {min !== null && <i className="bdt-orb bdt-sun bdt-sun-sm" style={{ left: `${x / 10}%`, top: `${(y / 620) * 100}%` }} />}
      </div>
    </>
  );
}

function TerraLayers({ mood, level, timeZone }: { mood: BackdropMood; level: Level; timeZone?: string }) {
  const id = useId().replace(/:/g, '');
  switch (mood) {
    case 'aurora':
      return <TerraSky timeZone={timeZone} />;
    case 'constellation': {
      let g = 'M0 100';
      for (let x = 0; x <= 1200; x += 8) g += ` L${x} ${f1(66 + Math.sin(x * 0.07) * 6 + Math.sin(x * 0.31) * 10 + ((x / 8) % 3) * 3)}`;
      return (
        <>
          <div className="bdt-dusk" />
          <svg className="bdt-grass" viewBox="0 0 1200 100" preserveAspectRatio="none"><path d={`${g} L1200 100 Z`} /></svg>
          <Fireflies n={24} seed={23} />
        </>
      );
    }
    case 'sweep':
      return <TerraSunPath timeZone={timeZone} />;
    case 'horizon': {
      const r = seeded(57);
      return (
        <>
          <div className="bdt-sky2" />
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} className="bdt-cloud bdt-cloud-l" style={{ top: `${f1(2 + r() * 24)}%`, width: `${(130 + r() * 140).toFixed(0)}px`, animationDuration: `${(100 + r() * 70).toFixed(0)}s`, animationDelay: `-${(r() * 160).toFixed(0)}s` }} />
          ))}
          {[[9, 50, 10], [12, 64, 40]].map(([top, d, del], i) => (
            <span key={i} className="bdt-bird" style={{ top: `${top}%`, animationDuration: `${d}s`, animationDelay: `-${del}s` }}>
              <svg width="24" height="11" viewBox="0 0 22 10"><path d="M1 3 Q6 0 11 6 Q16 0 21 3" /></svg>
            </span>
          ))}
          <svg className="bdt-hills" viewBox="0 0 800 140" preserveAspectRatio="none">
            <path d={`${ridge(400, 70, [[16, 1], [8, 3]], 3)} L800 140 L0 140Z`} className="bdt-hill1" />
            <path d={`${ridge(400, 100, [[16, 2], [8, 4]], 9)} L800 140 L0 140Z`} className="bdt-hill2" />
          </svg>
        </>
      );
    }
    case 'blueprint':
      return (
        <svg className="bdt-full" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <g className="bdt-topo">{TOPO_LINES.map((l, i) => <path key={i} d={l.d} className={l.ix ? 'bdt-ix' : undefined} />)}</g>
          <path d={TOPO_ROUTE} className="bdt-route" />
          {TOPO_PINS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6" className="bdt-pin" />)}
          {level === 'lively' ? (
            <circle r="7" className="bdt-walker">
              <animateMotion dur="60s" repeatCount="indefinite" path={TOPO_ROUTE} keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" />
            </circle>
          ) : (
            <circle cx={TOPO_REST[0]} cy={TOPO_REST[1]} r="7" className="bdt-walker" />
          )}
        </svg>
      );
    case 'mesh': {
      const r = seeded(77);
      return (
        <>
          <div className="bdt-canopy" />
          {Array.from({ length: 14 }, (_, i) => {
            const s = 60 + r() * 170;
            return <i key={i} className="bdt-dap" style={{ width: s, height: s * 0.8, left: `${f1(r() * 92)}%`, top: `${f1(r() * 88)}%`, '--x': `${((r() - 0.5) * 70).toFixed(0)}px`, '--y': `${((r() - 0.5) * 50).toFixed(0)}px`, '--d': `${f1(9 + r() * 8)}s`, animationDelay: `-${f1(r() * 9)}s` } as React.CSSProperties} />;
          })}
          {Array.from({ length: 4 }, (_, i) => (
            <i key={`l${i}`} className="bdt-leaf" style={{ left: `${f1(r() * 90)}%`, animationDuration: `${f1(26 + r() * 10)}s`, animationDelay: `-${f1(r() * 30)}s` }} />
          ))}
        </>
      );
    }
    case 'studio':
      return (
        <>
          <div className="bdt-sand" />
          <svg className="bdt-full bdt-zen" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
            <defs>
              <mask id={`zm${id}`}>
                <rect width="1200" height="800" fill="#fff" />
                {ZEN_STONES.map(([x, y, s], i) => <circle key={i} cx={x} cy={y} r={s + 80} fill="#000" />)}
              </mask>
              <radialGradient id={`zs${id}`} cx="40%" cy="35%">
                <stop offset="0" className="bdt-stone-a" />
                <stop offset="1" className="bdt-stone-b" />
              </radialGradient>
            </defs>
            <g mask={`url(#zm${id})`}>{ZEN_LINES.map((d, i) => <path key={i} d={d} />)}</g>
            {ZEN_STONES.map(([x, y, s], i) => (
              <g key={i}>
                <g className="bdt-ripple">{[1, 2, 3, 4].map((k) => <circle key={k} cx={x} cy={y} r={s + k * 17} />)}</g>
                <ellipse cx={x} cy={y} rx={s} ry={s * 0.82} fill={`url(#zs${id})`} />
              </g>
            ))}
          </svg>
          <div className="bdt-rake" />
        </>
      );
    case 'rings':
      return (
        <>
          <div className="bdt-dusk2" />
          <div className="bdt-sea">
            <svg className="bdt-wv" viewBox="0 0 1600 60" preserveAspectRatio="none">
              {([[20, 16, 3], [40, 12, 4]] as const).map(([y, k, a], i) => {
                let d = `M0 ${y}`;
                for (let x = 0; x <= 1600; x += 20) d += ` L${x} ${f1(y + Math.sin((x / 1600) * Math.PI * 2 * k) * a)}`;
                return <path key={i} d={d} />;
              })}
            </svg>
          </div>
          <div className="bdt-lh">
            <div className="bdt-beam" />
            <svg className="bdt-house" width="40" height="100" viewBox="0 0 40 100">
              <path d="M14 0 h12 v6 h-12z" /><path d="M12 8 h16 l4 82 h-24z" /><path d="M4 90 h32 v8 h-32z" />
            </svg>
            <i className="bdt-lamp" />
          </div>
        </>
      );
    case 'floaters': {
      const r = seeded(91);
      return (
        <>
          <div className="bdt-warm" />
          {Array.from({ length: 24 }, (_, i) => (
            <span key={i} className="bdt-pw" style={{ left: `${f1(r() * 100 - 10)}%`, '--dx': `${(80 + r() * 180).toFixed(0)}px`, animationDuration: `${f1(18 + r() * 14)}s`, animationDelay: `-${f1(r() * 30)}s` } as React.CSSProperties}>
              <i className="bdt-pet" style={{ animationDuration: `${f1(3 + r() * 3)}s`, scale: (0.7 + r() * 0.6).toFixed(2) }} />
            </span>
          ))}
        </>
      );
    }
    case 'waves':
      return (
        <>
          <div className="bdt-mist" />
          <Ridges
            height="34%"
            layers={[
              { base: 130, amps: [[26, 2], [12, 5]], seed: 7, dur: 120, cls: 'bdt-r1' },
              { base: 150, amps: [[22, 3], [10, 7]], seed: 12, dur: 90, cls: 'bdt-r2', drop: -18 },
              { base: 170, amps: [[18, 2], [9, 6]], seed: 17, dur: 70, cls: 'bdt-r3', line: true, drop: -36 },
            ]}
          />
        </>
      );
    case 'quiet':
      return (
        <>
          <div className="bdt-linen" />
          <div className="bd-noise" />
          <svg className="bdt-vein" width="260" height="200" viewBox="0 0 260 200">
            <path d="M250 190 C 170 150, 90 120, 10 20" /><path d="M200 162 C 190 130, 180 110, 150 80" /><path d="M150 132 C 120 125, 100 120, 70 118" />
            <path d="M110 98 C 108 80, 100 60, 85 40" /><path d="M70 68 C 55 66, 40 66, 24 70" />
          </svg>
        </>
      );
    case 'pulse': {
      const r = seeded(13);
      return (
        <>
          <div className="bdt-polar" />
          {Array.from({ length: 40 }, (_, i) => (
            <i key={i} className="bd-star" style={{ left: `${f1(r() * 100)}%`, top: `${f1(r() * 55)}%`, animationDuration: `${f1(3 + r() * 5)}s` }} />
          ))}
          {([['#34d399', 22, 26, 20], ['#22d3ee', 46, 30, 26], ['#a78bfa', 70, 24, 22]] as const).map(([c, x, w, d], i) => (
            <i key={`c${i}`} className="bdt-cur" style={{ left: `${x}%`, width: `${w}%`, '--d': `${d}s`, '--c': c } as React.CSSProperties} />
          ))}
          <svg className="bdt-peaks" viewBox="0 0 800 110" preserveAspectRatio="none"><path d={`${ridge(400, 70, [[22, 2], [10, 5]], 4)} L800 110 L0 110Z`} /></svg>
        </>
      );
    }
    case 'hero':
      return (
        <>
          <div className="bdt-ph bdt-dusk bdt-golden" />
          <div className="bdt-bigsun" />
          <Ridges
            height="42%"
            className="bdt-hero-ridge"
            layers={[
              { base: 120, amps: [[34, 2], [14, 5]], seed: 21, dur: 140, cls: 'bdt-r1' },
              { base: 160, amps: [[26, 3], [12, 7]], seed: 22, dur: 100, cls: 'bdt-r3', drop: -20 },
            ]}
          />
          <Fireflies n={16} seed={33} top={[50, 95]} />
        </>
      );
    default:
      return null;
  }
}

// ─── Prism ───────────────────────────────────────────────────

function PrismLayers({ mood }: { mood: BackdropMood }) {
  const id = useId().replace(/:/g, '');
  switch (mood) {
    case 'aurora':
      return (
        <>
          <div className="bdp-gridf" />
          {([[30, -22, 'var(--bd-a1)', 18], [48, -8, 'var(--bd-a2)', 23], [66, 6, 'color-mix(in srgb, var(--bd-a1) 60%, #fff)', 20], [84, 18, 'var(--bd-a3)', 26]] as const).map(([l, a, c, d], i) => (
            <i key={i} className="bdp-beam" style={{ left: `${l}%`, '--a': `${a}deg`, '--c': c, '--d': `${d}s` } as React.CSSProperties} />
          ))}
          <div className="bdp-hline" />
        </>
      );
    case 'constellation':
      return (
        <>
          <i className="bdp-sh bdp-circ bdp-glide" style={{ right: '6%', top: '8%', width: 'min(16cqw, 220px)', aspectRatio: '1', background: 'color-mix(in srgb, var(--bd-a1) 45%, transparent)' }} />
          <i className="bdp-sh bdp-semi bdp-flip" style={{ right: '24%', top: '22%', width: 'min(12cqw, 170px)', aspectRatio: '2', background: 'color-mix(in srgb, var(--bd-a2) 50%, transparent)' }} />
          <i className="bdp-sh bdp-ring bdp-rotr" style={{ right: '-3%', top: '44%', width: 'min(22cqw, 300px)', aspectRatio: '1', borderColor: 'color-mix(in srgb, var(--bd-a3) 55%, transparent)', borderRightColor: 'transparent' }} />
          <i className="bdp-sh bdp-quar bdp-rot" style={{ left: '-3%', bottom: '-6%', width: 'min(20cqw, 260px)', aspectRatio: '1', background: 'color-mix(in srgb, #f59e0b 38%, transparent)' }} />
          <i className="bdp-sh bdp-circ" style={{ right: '18%', bottom: '10%', width: 30, height: 30, background: 'color-mix(in srgb, var(--bd-a1) 60%, transparent)' }} />
          <i className="bdp-sh bdp-glide" style={{ right: '32%', bottom: '24%', width: 110, height: 14, borderRadius: 2, background: 'color-mix(in srgb, var(--bd-tx) 20%, transparent)' }} />
        </>
      );
    case 'sweep':
      return (
        <svg className="bdp-chrono" viewBox="0 0 520 520">
          <circle cx="260" cy="260" r="236" className="bdp-ticks" />
          <circle cx="260" cy="260" r="205" className="bdp-r1" />
          <circle cx="260" cy="260" r="172" className="bdp-r2" />
          <circle cx="260" cy="260" r="140" className="bdp-r3" />
          <circle cx="260" cy="260" r="108" className="bdp-r4" />
          <line x1="260" y1="260" x2="260" y2="30" className="bdp-hand" />
          <circle cx="260" cy="260" r="5" className="bdp-hub" />
        </svg>
      );
    case 'horizon':
      return (
        <>
          <svg className="bdp-stripes" viewBox="0 0 300 300">
            <defs>
              <linearGradient id={`sg${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f59e0b" />
                <stop offset=".55" stopColor="#ec4899" />
                <stop offset="1" className="bdp-stop-a2" />
              </linearGradient>
              <mask id={`sm${id}`}>
                <circle cx="150" cy="150" r="148" fill="#fff" />
                {Array.from({ length: 6 }, (_, i) => <rect key={i} x="0" y={f1(160 + i * 24 + i * i * 1.5)} width="300" height={f1(3 + i * 2.6)} fill="#000" />)}
              </mask>
            </defs>
            <circle cx="150" cy="150" r="148" fill={`url(#sg${id})`} mask={`url(#sm${id})`} />
          </svg>
          <i className="bdp-hz" style={{ top: 360 }} />
          <i className="bdp-hz" style={{ top: 384, left: '30%' }} />
          <i className="bdp-hz" style={{ top: 412, left: '55%' }} />
        </>
      );
    case 'blueprint': {
      const cube = (h: number, c: string) => {
        const w = 60, s = 17;
        return (
          <svg width={w * 2} height={h + s * 4} viewBox={`0 0 ${w * 2} ${h + s * 4}`}>
            <polygon points={`${w},0 ${w * 2},${s * 2} ${w},${s * 4} 0,${s * 2}`} style={{ fill: `color-mix(in srgb, ${c} 55%, transparent)` }} />
            <polygon points={`0,${s * 2} ${w},${s * 4} ${w},${s * 4 + h} 0,${s * 2 + h}`} style={{ fill: `color-mix(in srgb, ${c} 30%, transparent)` }} />
            <polygon points={`${w * 2},${s * 2} ${w},${s * 4} ${w},${s * 4 + h} ${w * 2},${s * 2 + h}`} style={{ fill: `color-mix(in srgb, ${c} 18%, transparent)` }} />
          </svg>
        );
      };
      return (
        <>
          <div className="bdp-iso" />
          {([[62, 10, 100, 'var(--bd-a1)', 14], [76, 20, 56, 'var(--bd-a2)', 11], [52, 26, 34, 'var(--bd-a3)', 16], [69, 36, 150, 'var(--bd-a1)', 13]] as const).map(([x, y, h, c, d], i) => (
            <span key={i} className="bdp-blk" style={{ left: `${x}%`, top: `${y}%`, '--d': `${d}s` } as React.CSSProperties}>{cube(h, c)}</span>
          ))}
        </>
      );
    }
    case 'mesh':
      return (
        <>
          <svg className="bdt-full bdp-facets" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
            {FACETS.map((t, i) => <polygon key={i} points={t.pts} style={{ fill: t.fill, ...(t.live ? ({ '--d': t.d, animationDelay: t.delay } as React.CSSProperties) : {}) }} className={t.live ? 'bdp-glint' : undefined} />)}
          </svg>
          <div className="bdp-shine" />
        </>
      );
    case 'studio':
      return (
        <div className="bdp-3d">
          <div className="bdp-floor" />
          {([[58, 12, 130, 40, false], [78, 40, 70, 30, true], [46, 8, 48, 26, false]] as const).map(([x, y, s, d, rev], i) => (
            <span key={i} className="bdp-cube" style={{ left: `${x}%`, top: `${y}%`, '--s': `${s}px`, '--d': `${d}s`, animationDirection: rev ? 'reverse' : undefined } as React.CSSProperties}>
              <i /><i /><i /><i /><i /><i />
            </span>
          ))}
        </div>
      );
    case 'rings':
      return (
        <div className="bdp-radar">
          <div className="bdp-sweep" />
          {([[340, 110, 1.9], [140, 300, 4.1], [380, 350, 5.6], [240, 170, 3]] as const).map(([x, y, t], i) => (
            <i key={i} className="bdp-blip" style={{ left: x, top: y, animationDelay: `${t}s` }} />
          ))}
        </div>
      );
    case 'floaters': {
      const r = seeded(61);
      const cs = ['var(--bd-a1)', 'var(--bd-a2)', '#f59e0b', '#ec4899', 'var(--bd-a3)'];
      const kinds = ['tri', 'oring', 'plus', 'sq', 'zig'];
      return (
        <>
          <div className="bd-warm bdp-warm" />
          <i className="bdp-dotg" style={{ right: '3%', top: '6%' }} />
          <i className="bdp-dotg" style={{ left: '22%', bottom: '8%' }} />
          {Array.from({ length: 18 }, (_, i) => {
            const c = `color-mix(in srgb, ${cs[i % 5]} 60%, transparent)`;
            const k = kinds[(i * 3) % 5];
            const st: React.CSSProperties = { left: `${f1(r() * 98)}%`, animationDuration: `${f1(22 + r() * 16)}s`, animationDelay: `-${f1(r() * 36)}s`, color: c };
            return (
              <i key={i} className={`bdp-mf bdp-${k}`} style={st}>
                {k === 'plus' ? '+' : k === 'zig' ? <svg width="34" height="12" viewBox="0 0 34 12"><path d="M1 6 L6 1 L11 11 L16 1 L21 11 L26 1 L33 8" /></svg> : null}
              </i>
            );
          })}
        </>
      );
    }
    case 'waves': {
      const r = seeded(17);
      const cs = ['var(--bd-a1)', 'var(--bd-a2)', 'var(--bd-a3)'];
      return (
        <>
          <div className="bdp-guides" />
          <div className="bdp-eq">
            {Array.from({ length: 48 }, (_, i) => (
              <i key={i} style={{ '--c': cs[Math.floor(i / 16)], '--lo': (0.12 + r() * 0.25).toFixed(2), '--hi': (0.45 + r() * 0.55).toFixed(2), '--d': `${f1(7 + r() * 6)}s`, animationDelay: `-${f1(r() * 8)}s` } as React.CSSProperties} />
            ))}
          </div>
        </>
      );
    }
    case 'quiet':
      return (
        <>
          <div className="bdp-cols" />
          <div className="bdp-base" />
          <i className="bdp-acc-sq" />
          <i className="bdp-acc-ci" />
        </>
      );
    case 'pulse': {
      const r = seeded(5);
      return (
        <>
          <div className="bdp-sky" />
          {Array.from({ length: 30 }, (_, i) => (
            <i key={i} className="bd-star" style={{ left: `${f1(r() * 100)}%`, top: `${f1(r() * 40)}%`, animationDuration: `${f1(3 + r() * 5)}s` }} />
          ))}
          <div className="bdp-plane"><i /></div>
          <div className="bdp-horizon" />
          <i className="bdp-run" />
        </>
      );
    }
    case 'hero':
      return (
        <>
          <div className="bdp-gridf bdp-gridf-hero" />
          <div className="bdp-fan" />
          <i className="bdp-ray" />
          <i className="bdp-gem" />
        </>
      );
    default:
      return null;
  }
}

export function PackLayers({ pack, mood, level, timeZone }: { pack: 'terra' | 'prism'; mood: BackdropMood; level: Level; timeZone?: string }) {
  return pack === 'terra' ? <TerraLayers mood={mood} level={level} timeZone={timeZone} /> : <PrismLayers mood={mood} />;
}
