'use client';

import React from 'react';
import { cn } from '@/lib/cn';
import { STATUS_META, clock, hours, type CalendarDay, type DayStatus, lateBy } from '@/lib/company/attendance';
import { STATUS_BG } from '@/components/time/visuals';

const HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LEGEND: DayStatus[] = ['PRESENT', 'HALF_DAY', 'ABSENT', 'MISSING_CHECKOUT', 'ON_LEAVE', 'WORK_FROM_HOME', 'HOLIDAY', 'WEEKEND'];

/** Month grid (Monday first). Each day shows its status, in / out and flags. */
export function MonthCalendar({
  days,
  today,
  timeZone,
  selected,
  onSelect,
  fullDayMinutes,
}: {
  days: CalendarDay[];
  today: string;
  timeZone: string;
  selected?: string | null;
  onSelect?: (day: CalendarDay) => void;
  /** Show an hours bar on each worked day */
  fullDayMinutes?: number;
}) {
  if (!days.length) return null;
  const lead = (new Date(`${days[0]!.date}T00:00:00Z`).getUTCDay() + 6) % 7; // blanks before the 1st

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-2xs font-medium uppercase tracking-wider text-muted-foreground sm:gap-1.5">
        {HEAD.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="grid" aria-label="Attendance calendar">
        {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} aria-hidden />)}
        {days.map((d) => {
          const meta = STATUS_META[d.status];
          const isToday = d.date === today;
          const clickable = Boolean(onSelect) && d.status !== 'NOT_JOINED' && d.date <= today;
          return (
            <button
              key={d.date}
              type="button"
              style={{ animationDelay: `${Number(d.date.slice(8)) * 12}ms` }}
              role="gridcell"
              disabled={!clickable}
              onClick={() => onSelect?.(d)}
              aria-label={`${d.date}: ${d.holiday?.name ?? meta.label}`}
              aria-selected={selected === d.date}
              className={cn(
                'm-pop relative flex min-h-[64px] flex-col rounded-lg p-1.5 text-left transition-shadow sm:min-h-[84px] sm:p-2',
                meta.cell,
                clickable && 'hover:shadow-card hover:ring-1 hover:ring-foreground/20',
                selected === d.date && 'ring-2 ring-primary',
                !clickable && 'cursor-default',
              )}
            >
              <span className={cn('flex items-center justify-between text-xs font-semibold tabular-nums', isToday && 'text-primary')}>
                <span className={cn(isToday && 'flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground')}>
                  {Number(d.date.slice(8))}
                </span>
                {meta.short && <span className="hidden text-2xs font-bold sm:inline">{meta.short}</span>}
              </span>
              <span className="mt-auto hidden space-y-0.5 text-[10px] leading-tight sm:block">
                {d.holiday ? (
                  <span className="line-clamp-2 font-medium">{d.holiday.name}</span>
                ) : d.leave && !d.checkIn ? (
                  <span className={cn('block truncate font-medium', d.leave.status === 'PENDING' && 'italic opacity-75')}>
                    {d.leave.code}{d.leave.halfDay ? ' ½' : ''}{d.leave.status === 'PENDING' ? ' · pending' : ''}
                  </span>
                ) : d.checkIn ? (
                  <>
                    <span className="block tabular-nums">{clock(d.checkIn, timeZone)}–{d.checkOut ? clock(d.checkOut, timeZone) : '…'}</span>
                    {(d.lateMinutes ?? 0) > 0 && <span className="block font-medium text-warning">Late {lateBy(d.lateMinutes)}</span>}
                  </>
                ) : null}
              </span>
              {fullDayMinutes && d.workingMinutes ? (
                <span className='mt-1 hidden h-1 overflow-hidden rounded-full bg-black/10 sm:block' title={hours(d.workingMinutes) + ' worked'}>
                  <span className={cn('m-fill-w block h-full rounded-full', STATUS_BG[d.status])} style={{ width: Math.min(100, (d.workingMinutes / fullDayMinutes) * 100) + '%' }} />
                </span>
              ) : null}
              {d.autoClosed && <span className='absolute left-1/2 top-1 hidden -translate-x-1/2 text-[9px] font-bold uppercase text-violet-600 sm:block' title='Closed automatically — you forgot to check out'>auto</span>}
              {d.correction?.status === 'PENDING' && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-warning sm:right-1.5 sm:top-auto sm:bottom-1.5" title="Correction pending" />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {LEGEND.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn('h-3 w-3 rounded', STATUS_META[s].cell)} /> {STATUS_META[s].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" /> Correction pending</span>
      </div>
    </div>
  );
}
