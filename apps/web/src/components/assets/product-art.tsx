'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AssetIcon } from '@/lib/company/assets';
import { cn } from '@/lib/cn';

/**
 * A drawn picture of an asset (laptop, monitor, phone, ID card…) with its own
 * short moment: `play` runs it once (hand-over, "I got it"), `hover` replays it
 * on hover. Styles live in app/motion.css (.pa-*); reduced motion snaps to the
 * last frame.
 */
export function ProductArt({
  icon,
  size = 'md',
  play,
  hover,
  state,
  label,
  className,
}: {
  icon: AssetIcon | string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  play?: boolean;
  hover?: boolean;
  state?: 'repair' | 'loan' | 'lost' | null;
  /** Text on screens / cards */
  label?: string;
  className?: string;
}) {
  const scale = size === 'xs' ? 0.28 : size === 'sm' ? 0.45 : size === 'md' ? 0.7 : 1;
  return (
    <div className={cn('relative shrink-0', hover && 'pa-hover', className)} style={{ width: 180 * scale, height: 130 * scale }} aria-hidden>
      <div className={cn('pa absolute left-0 top-0 origin-top-left', play && 'pa-play', state === 'lost' && 'pa-lost')} style={{ transform: `scale(${scale})` }}>
        <Device icon={icon} label={label} />
        {state === 'repair' && <span className="pa-state repair">🔧</span>}
        {state === 'loan' && <span className="pa-state loan">⏳</span>}
        {state === 'lost' && <span className="pa-radar" />}
      </div>
    </div>
  );
}

function Device({ icon, label }: { icon: string; label?: string }) {
  switch (icon) {
    case 'laptop':
      return (
        <div className="pa-lap">
          <div className="scr">
            <i className="pa-glow" />
            <b>{label ?? ''}</b>
          </div>
          <div className="base" />
        </div>
      );
    case 'monitor':
      return (
        <div className="pa-mon">
          <div className="scr"><i className="pa-glow" /></div>
          <div className="neck" />
          <div className="foot" />
        </div>
      );
    case 'phone':
      return (
        <>
          <div className="pa-ph"><i /></div>
          <span className="pa-ph-note">✓ Received</span>
        </>
      );
    case 'idcard':
      return (
        <div className="pa-id">
          <div className="in">
            <div className="f">
              <div className="face" />
              <div className="min-w-0">
                <b className="block truncate text-[12px]">{label ?? 'ID card'}</b>
                <span className="text-[9px] opacity-80">Employee</span>
              </div>
            </div>
            <div className="bk">
              <div className="bars" />
            </div>
          </div>
        </div>
      );
    case 'headset':
      return (
        <div className="pa-hs">
          🎧<span className="wave l" /><span className="wave r" /><span className="wave l d" /><span className="wave r d" />
        </div>
      );
    case 'keyboard':
      return (
        <div className="pa-kb">
          <div className="keys">
            {Array.from({ length: 24 }, (_, i) => <span key={i} style={{ animationDelay: `${((i * 7) % 24) * 0.03}s` }} />)}
          </div>
          <div className="mouse" />
        </div>
      );
    case 'sim':
      return <div className="pa-sim"><i /></div>;
    default:
      return (
        <div className="pa-box">
          <div className="bx" />
          <div className="lid" />
        </div>
      );
  }
}

/** "I got it": the box opens, the item rises, a ✓ stamp lands — then it goes away. */
export function UnboxMoment({ icon, label, onDone }: { icon: AssetIcon | string; label?: string; onDone: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  if (!mounted) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-background/40 backdrop-blur-[2px]" role="status" aria-live="polite">
      <div className="rounded-3xl bg-surface p-6 shadow-dialog">
        <div className="pa-unbox">
          <div className="item"><ProductArt icon={icon} size="md" label={label} /></div>
          <div className="bx" />
          <div className="lid" />
          <div className="stamp">✓ Received</div>
        </div>
        <p className="mt-2 text-center text-sm font-semibold">Thanks — confirmed</p>
      </div>
    </div>,
    document.body,
  );
}

/** Ring that empties as a loan's return date nears; amber 2 days before, red and a small shake when overdue. */
export function LoanRing({ dueBack, from }: { dueBack: string; from?: string | null }) {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const end = Date.parse(`${dueBack}T00:00:00Z`);
  const start = from ? Date.parse(`${from}T00:00:00Z`) : end - 14 * 86_400_000;
  const left = Math.round((end - today) / 86_400_000);
  const pct = Math.max(0, Math.min(100, ((end - today) / Math.max(1, end - start)) * 100));
  const overdue = left < 0;
  const color = overdue ? 'hsl(var(--destructive))' : left <= 2 ? 'hsl(var(--warning))' : 'hsl(var(--success))';
  return (
    <span className={cn('pa-ring', overdue && 'overdue')} style={{ ['--pct' as string]: `${overdue ? 100 : pct}%`, ['--ring' as string]: color } as React.CSSProperties} title={overdue ? `Overdue by ${-left} day${left === -1 ? '' : 's'}` : `${left} day${left === 1 ? '' : 's'} left`}>
      <b style={{ color }}>{overdue ? '!' : `${left}d`}</b>
    </span>
  );
}
