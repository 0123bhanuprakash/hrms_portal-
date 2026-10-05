'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Clock3, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { projectColor } from '@/components/projects/project-ui';
import { DAY_STATUS, clock, dayLabel, fmtHours, type Block, type BlockProject, type Week, type WeekDay } from '@/lib/company/timesheets';
import { cn } from '@/lib/cn';

export const GENERAL_COLOR = '#64748B';
export const blockColor = (p: BlockProject | { color: string | null; code: string } | null) => (p ? projectColor(p) : GENERAL_COLOR);

const SNAP = 15;
const snap = (m: number) => Math.floor(m / SNAP) * SNAP;

/** Hours shown: 8 am – 7 pm, stretched to fit early/late blocks, check-ins and night work. */
function hourRange(week: Week, dates: string[]) {
  let from = 8;
  let to = 19;
  for (const d of week.days.filter((x) => dates.includes(x.date))) {
    const a = d.attendance;
    // A real stretch in the office (ignore stray one-minute check-ins)
    if (a?.checkIn == null || (a.checkOut != null && a.checkOut - a.checkIn < 30)) continue;
    from = Math.min(from, Math.floor(a.checkIn / 60));
    if (a.checkOut != null) to = Math.max(to, Math.ceil(a.checkOut / 60));
  }
  for (const b of week.blocks.filter((x) => dates.includes(x.date) && x.startMin != null)) {
    from = Math.min(from, Math.floor(b.startMin! / 60));
    to = Math.max(to, Math.ceil(b.endMin! / 60));
  }
  return { from: Math.max(0, from), to: Math.min(36, Math.max(to, from + 4)) };
}

interface Props {
  week: Week;
  dates: string[];
  editable: boolean;
  onCreate: (date: string, startMin: number, endMin: number) => void;
  onOpen: (b: Block) => void;
  onPickDay?: (date: string) => void;
  hourHeight?: number;
}

/** Tempo-style calendar: drag on a day to log a block, click a block to open it. */
export function WeekCalendar({ week, dates, editable, onCreate, onOpen, onPickDay, hourHeight = 46 }: Props) {
  const { from, to } = hourRange(week, dates);
  const HH = hourHeight;
  const height = (to - from) * HH;
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const [drag, setDrag] = useState<{ date: string; a: number; b: number; moved: boolean } | null>(null);
  const days = dates.map((d) => week.days.find((x) => x.date === d)!).filter(Boolean);
  const cols = days.map((d) => (dates.length > 1 && d.weekend ? '0.6fr' : 'minmax(0,1fr)')).join(' ');
  const yToMin = (el: HTMLElement, clientY: number) => from * 60 + ((clientY - el.getBoundingClientRect().top) / HH) * 60;
  const canLog = (d: WeekDay) => editable && !d.future && !d.locked;
  const scroller = useRef<HTMLDivElement>(null);
  const first = Math.min(8, ...week.blocks.filter((b) => dates.includes(b.date) && b.startMin != null).map((b) => Math.floor(b.startMin! / 60)));
  const scrollKey = `${week.weekStart}|${dates.join()}`;
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, (first - from) * HH - 8);
  }, [scrollKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {/* Day headers */}
      <div className="grid border-b border-border bg-subtle/60" style={{ gridTemplateColumns: `52px ${cols}` }}>
        <div />
        {days.map((d) => {
          const isToday = d.date === week.today;
          const s = d.status !== 'empty' ? DAY_STATUS[d.status] : null;
          const untimed = week.blocks.filter((b) => b.date === d.date && b.startMin == null);
          const pct = d.expectedMinutes ? Math.min(100, (d.minutes / d.expectedMinutes) * 100) : 0;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => onPickDay?.(d.date)}
              disabled={!onPickDay}
              className={cn('flex min-w-0 flex-col gap-1 border-l border-border/60 px-2.5 py-2 text-left', onPickDay && 'hover:bg-subtle', d.weekend && 'bg-subtle/80')}
            >
              <span className="flex items-center justify-between gap-1">
                <span className={cn('truncate text-xs font-bold', isToday ? 'text-primary' : 'text-foreground')}>{dayLabel(d.date)}{isToday && dates.length > 1 ? ' · today' : ''}</span>
                {s && <Badge tone={s.tone} className="shrink-0 px-1.5 py-0 text-[10px]">{s.label}</Badge>}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {d.holiday ? `🎉 ${d.holiday}` : d.leave && !d.leave.halfDay ? `🌴 ${d.leave.type}` : d.weekend && !d.minutes ? 'Weekend' : (
                  <>
                    <b className="text-foreground">{fmtHours(d.minutes)}</b>
                    {d.attendance?.workingMinutes ? ` · ${fmtHours(d.attendance.workingMinutes)} in` : d.attendance?.open ? ' · checked in' : ''}
                  </>
                )}
              </span>
              {d.expectedMinutes > 0 && (
                <span className="h-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? 'hsl(var(--success))' : 'hsl(var(--primary))' }} /></span>
              )}
              {untimed.length > 0 && <span className="truncate text-[10px] text-muted-foreground" title="Logged before time blocks">+ {fmtHours(untimed.reduce((n, b) => n + b.minutes, 0))} without times</span>}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div ref={scroller} className="relative max-h-[640px] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: `52px ${cols}` }}>
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1.5 text-[10.5px] tabular-nums text-muted-foreground" style={{ top: (h - from) * HH }}>
                {h === from ? '' : clock((h % 24) * 60).replace(':00', '')}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const blocks = week.blocks.filter((b) => b.date === d.date && b.startMin != null);
            const att = d.attendance;
            const attEnd = att?.checkOut ?? (att?.open && d.date === week.today ? week.nowMin : null);
            const off = (d.leave && !d.leave.halfDay) || d.holiday;
            return (
              <div
                key={d.date}
                className={cn('relative select-none border-l border-border/60', d.weekend && 'bg-subtle/50', canLog(d) ? 'cursor-crosshair' : d.future && 'cursor-not-allowed bg-[repeating-linear-gradient(135deg,transparent_0_8px,hsl(var(--muted)/.5)_8px_16px)]')}
                style={{ height, touchAction: 'pan-y' }}
                onPointerDown={(e) => {
                  if (!canLog(d) || e.button !== 0 || (e.target as HTMLElement).closest('[data-block]')) return;
                  const m = snap(yToMin(e.currentTarget, e.clientY));
                  setDrag({ date: d.date, a: m, b: m + SNAP, moved: false });
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!drag || drag.date !== d.date) return;
                  const m = Math.round(yToMin(e.currentTarget, e.clientY) / SNAP) * SNAP;
                  if (m !== drag.b) setDrag({ ...drag, b: Math.max(m, drag.a + SNAP), moved: true });
                }}
                onPointerUp={() => {
                  if (!drag || drag.date !== d.date) return;
                  const { a, b, moved } = drag;
                  setDrag(null);
                  onCreate(d.date, a, moved ? b : a + 60);
                }}
                onPointerCancel={() => setDrag(null)}
              >
                {hours.map((h) => <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: (h - from) * HH }} />)}
                {off && (
                  <div className="pointer-events-none absolute inset-1.5 flex flex-col items-center justify-center gap-1 rounded-lg bg-[repeating-linear-gradient(135deg,hsl(var(--primary-soft))_0_10px,transparent_10px_20px)] text-xs font-bold text-primary-soft-foreground">
                    {d.holiday ? `🎉 ${d.holiday}` : `🌴 ${d.leave!.type}`}
                    <span className="text-[11px] font-medium">Nothing to log</span>
                  </div>
                )}
                {att?.checkIn != null && attEnd != null && attEnd - att.checkIn >= 30 && (
                  <div className="pointer-events-none absolute left-0 w-1 rounded-r bg-success/60" style={{ top: (att.checkIn - from * 60) * (HH / 60), height: Math.max(4, (attEnd - att.checkIn) * (HH / 60)) }} title="Checked in" />
                )}
                {blocks.map((b) => <BlockCard key={b.id} b={b} top={(b.startMin! - from * 60) * (HH / 60)} height={(b.endMin! - b.startMin!) * (HH / 60)} onOpen={onOpen} />)}
                {drag?.date === d.date && (
                  <div className="pointer-events-none absolute inset-x-1.5 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary-soft/70 text-[11px] font-bold text-primary-soft-foreground" style={{ top: (Math.min(drag.a, drag.b) - from * 60) * (HH / 60), height: Math.abs(drag.b - drag.a) * (HH / 60) }}>
                    {clock(drag.a)} – {clock(drag.b)} · {fmtHours(drag.b - drag.a)}
                  </div>
                )}
                {d.date === week.today && week.nowMin / 60 >= from && week.nowMin / 60 <= to && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-destructive" style={{ top: (week.nowMin - from * 60) * (HH / 60) }}>
                    <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-destructive" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlockCard({ b, top, height, onOpen }: { b: Block; top: number; height: number; onOpen: (b: Block) => void }) {
  const c = blockColor(b.project);
  const small = height < 34;
  const Icon = b.status === 'APPROVED' ? Check : b.status === 'SUBMITTED' ? Clock3 : b.status === 'REJECTED' ? AlertTriangle : null;
  return (
    <button
      type="button"
      data-block
      onClick={() => onOpen(b)}
      title={`${b.project?.name ?? 'General'} · ${b.description}\n${clock(b.startMin!)} – ${clock(b.endMin!)} · ${fmtHours(b.minutes)}`}
      className={cn(
        'absolute inset-x-1.5 overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left text-[11px] leading-tight shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        b.status === 'REJECTED' && 'ring-2 ring-destructive/70',
        b.status === 'APPROVED' && 'opacity-90',
      )}
      style={{ top: top + 1, height: Math.max(14, height - 3), background: `${c}1f`, borderColor: c }}
    >
      {Icon && <Icon className={cn('absolute right-1 top-1 h-3 w-3', b.status === 'REJECTED' ? 'text-destructive' : b.status === 'APPROVED' ? 'text-success' : 'text-muted-foreground')} />}
      {small ? (
        <span className="block truncate pr-3 font-semibold" style={{ color: c }}>{b.project?.code ?? 'General'} · <span className="font-normal text-foreground">{b.description}</span></span>
      ) : (
        <>
          <span className="block truncate pr-3 font-bold" style={{ color: c }}>{b.project?.name ?? 'General'}</span>
          <span className="line-clamp-2 text-foreground/90">{b.description}</span>
          {height >= 56 && <span className="mt-0.5 block font-semibold text-muted-foreground">{clock(b.startMin!)} – {clock(b.endMin!)} · {fmtHours(b.minutes)}</span>}
        </>
      )}
      {b.status === 'APPROVED' && height >= 56 && <Lock className="absolute bottom-1 right-1 h-3 w-3 text-muted-foreground" />}
    </button>
  );
}
