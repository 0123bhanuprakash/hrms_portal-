'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { useUiState } from '@/lib/preferences/ui-state';
import { stopSeasonPreview, useActiveSeason, useSeasonPreview, type Decoration, type Season, type SeasonColors } from '@/lib/company/seasons';
import { cn } from '@/lib/cn';

const isChoice = (v: unknown): v is 'season' | 'mine' => v === 'season' || v === 'mine';
const isPick = (v: unknown): v is 'keep' | 'mine' | '' => v === 'keep' || v === 'mine' || v === '';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

/**
 * The season on now (or one being tried for 10 minutes), and whether its look
 * applies to me: a season is on for everyone; each person can switch back to
 * their own theme (for this season, or always in Preferences).
 */
export function useSeasonLook() {
  const companyId = useAuthStore((s) => s.companyId);
  const active = useActiveSeason(Boolean(companyId));
  const preview = useSeasonPreview();
  const season = preview?.season ?? active.data ?? null;
  const [always] = useUiState<'season' | 'mine'>('season.default', 'season', isChoice);
  const [pick, setPick] = useUiState<'keep' | 'mine' | ''>(`season.choice.${season?.id ?? 'none'}.${season?.startsOn ?? ''}`, '', isPick);
  const [decorations] = useUiState<boolean>('season.decorations', true, isBool);
  const applies = Boolean(season) && (preview ? true : pick ? pick === 'keep' : always === 'season');
  return { season, applies, decorations, previewing: Boolean(preview), previewUntil: preview?.until ?? null, pick, setPick, always };
}

// ─── Decorations ────────────────────────────────────────────

const seeded = (n: number, seed: number) => Array.from({ length: n }, (_, i) => ((i + 1) * 9301 + seed * 49297) % 233280 / 233280);

/** A small decoration layer; place it inside a `relative overflow-hidden` box. */
export function SeasonDecor({ kind, colors, className, dense = false }: { kind: Decoration; colors: SeasonColors; className?: string; dense?: boolean }) {
  if (kind === 'none') return null;
  const r = seeded(40, kind.length);
  const palette = [colors.accent, '#FFE7A8', colors.main, '#FFFFFF'];
  const n = dense ? 1.6 : 1;
  let body: React.ReactNode = null;
  switch (kind) {
    case 'fireworks':
      body = (
        <>
          {Array.from({ length: Math.round(18 * n) }, (_, i) => (
            <span key={`s${i}`} className="sz-star" style={{ left: `${r[i]! * 100}%`, top: `${r[(i + 7) % 40]! * 100}%`, animationDelay: `${(i % 7) * 0.35}s` }} />
          ))}
          {[
            [62, 22, 0.2],
            [78, 55, 1.1],
            [54, 70, 1.9],
            [88, 18, 2.4],
          ].map(([x, y, delay], k) => (
            <span key={`b${k}`} className="sz-burst" style={{ left: `${x}%`, top: `${y}%` }}>
              {Array.from({ length: 14 }, (_, i) => (
                <i key={i} style={{ ['--r' as string]: `${(i / 14) * 360}deg`, ['--d' as string]: `${40 + k * 8}px`, background: palette[k % palette.length], boxShadow: `0 0 6px ${palette[k % palette.length]}`, animationDelay: `${delay}s` }} />
              ))}
            </span>
          ))}
        </>
      );
      break;
    case 'sparkles':
      body = Array.from({ length: Math.round(12 * n) }, (_, i) => (
        <span key={i} className="sz-sparkle" style={{ left: `${r[i]! * 96}%`, top: `${r[(i + 5) % 40]! * 90}%`, animationDelay: `${(i % 6) * 0.3}s` }}>✨</span>
      ));
      break;
    case 'snow':
      body = Array.from({ length: Math.round(18 * n) }, (_, i) => (
        <span key={i} className="sz-fall sz-flake" style={{ left: `${r[i]! * 100}%`, animationDuration: `${4 + (i % 4)}s`, animationDelay: `${r[(i + 3) % 40]! * 4}s`, ['--x' as string]: `${(r[(i + 9) % 40]! - 0.5) * 40}px` }} />
      ));
      break;
    case 'confetti':
      body = Array.from({ length: Math.round(22 * n) }, (_, i) => (
        <span key={i} className="sz-fall sz-confetti" style={{ left: `${r[i]! * 100}%`, background: palette[i % 3], animationDuration: `${3.5 + (i % 4)}s`, animationDelay: `${r[(i + 3) % 40]! * 4}s`, ['--rot' as string]: '540deg' }} />
      ));
      break;
    case 'petals':
      body = Array.from({ length: Math.round(9 * n) }, (_, i) => (
        <span key={i} className="sz-fall" style={{ left: `${r[i]! * 100}%`, fontSize: 15, animationDuration: `${4.5 + (i % 3)}s`, animationDelay: `${r[(i + 3) % 40]! * 4}s`, ['--x' as string]: '30px', ['--rot' as string]: '300deg' }}>🌸</span>
      ));
      break;
    case 'kites':
      body = [
        [70, 18, 0],
        [86, 46, 0.8],
        [60, 58, 1.6],
      ].map(([x, y, d], i) => (
        <span key={i} className="sz-kite" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }}>🪁</span>
      ));
      break;
    case 'lanterns':
      body = [62, 74, 86].map((x, i) => (
        <span key={i} className="sz-lantern" style={{ left: `${x}%`, top: 0, animationDelay: `${i * 0.4}s` }}>🏮</span>
      ));
      break;
    case 'diyas':
      body = [
        [84, 72],
        [90, 72],
        [78, 72],
      ].map(([x, y], i) => (
        <span key={i} className="sz-diya" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.45}s` }}>🪔</span>
      ));
      break;
    case 'ribbon':
      body = <span className="sz-ribbon" />;
      break;
    case 'splash':
      body = [colors.main, colors.accent, colors.deep, '#F59E0B'].map((c, i) => (
        <span key={i} className="sz-splash" style={{ left: `${55 + i * 10}%`, top: `${20 + (i % 2) * 35}%`, background: c, animationDelay: `${i * 0.6}s` }} />
      ));
      break;
    case 'marigold':
      body = (
        <span className="sz-garland">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.15}s` }}>{i % 2 ? '🌼' : '🏵️'}</span>
          ))}
        </span>
      );
      break;
    case 'dandiya':
      body = [76, 86].map((x, i) => (
        <span key={i} className="sz-dandiya" style={{ left: `${x}%`, top: '30%', animationDelay: `${i * 0.6}s` }}>🥢</span>
      ));
      break;
  }
  return <div aria-hidden className={cn('sz-layer', className)}>{body}</div>;
}

// ─── Home banner ────────────────────────────────────────────

export function SeasonBanner({ season, firstName, className }: { season: Season; firstName?: string; className?: string }) {
  const { decorations } = useSeasonLook();
  const c = season.colors;
  return (
    <section
      className={cn('relative overflow-hidden rounded-2xl px-6 py-5 text-white shadow-card m-rise', className)}
      style={{ background: `radial-gradient(circle at 85% 0%, ${c.accent}66, transparent 55%), radial-gradient(circle at 0% 100%, ${c.main}55, transparent 50%), linear-gradient(135deg, ${c.deep}, ${c.main})` }}
      aria-label={season.name}
    >
      {decorations && <SeasonDecor kind={season.decoration} colors={c} />}
      <div className="relative flex flex-wrap items-center gap-4">
        <span className="text-4xl drop-shadow-sm" aria-hidden>{season.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-80">{season.name}{season.daysLeft ? ` · ${season.daysLeft === 1 ? 'last day' : `${season.daysLeft} days left`}` : ''}</p>
          <p className="mt-1 text-xl font-bold leading-tight sm:text-2xl">
            {season.greeting || `Happy ${season.name}`}
            {firstName && <span className="opacity-80">, {firstName}</span>}
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Side popup: keep the season or switch back ─────────────

export function SeasonPopup() {
  const { season, previewing, previewUntil, pick, setPick, always } = useSeasonLook();
  if (!season) return null;
  if (previewing) {
    return (
      <div role="status" className="fixed bottom-4 right-4 z-40 flex w-[calc(100%-2rem)] max-w-sm items-center gap-3 rounded-2xl border border-border bg-raised p-3 shadow-dialog sz-pop">
        <span className="text-2xl" aria-hidden>{season.emoji}</span>
        <p className="min-w-0 flex-1 text-sm">
          <b>Trying “{season.name}”</b>
          <span className="block text-xs text-muted-foreground">Only you see it · ends {previewUntil ? new Date(previewUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'soon'}</span>
        </p>
        <Button size="sm" variant="secondary" onClick={stopSeasonPreview}>Stop</Button>
      </div>
    );
  }
  if (pick || always === 'mine') return null;
  return (
    <div role="dialog" aria-label={`${season.name} is on`} className="fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-border bg-raised p-4 shadow-dialog sz-pop">
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden>{season.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{season.name} is on for everyone</p>
          <p className="text-xs text-muted-foreground">Until {formatDay(season.endsOn)} · then back to normal</p>
        </div>
        <button type="button" aria-label="Keep it" onClick={() => setPick('keep')} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" className="flex-1" style={{ background: `linear-gradient(135deg, ${season.colors.main}, ${season.colors.accent})` }} onClick={() => setPick('keep')}>
          Keep it ✨
        </Button>
        <Button size="sm" variant="secondary" className="flex-1" onClick={() => setPick('mine')}>
          Switch back to my theme
        </Button>
      </div>
    </div>
  );
}

const formatDay = (k: string) => new Date(`${k}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
