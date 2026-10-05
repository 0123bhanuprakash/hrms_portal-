'use client';

import React from 'react';
import Link from 'next/link';
import { Mail, Star } from 'lucide-react';
import { Card } from '@/components/ui/feedback';
import { useUiState } from '@/lib/preferences/ui-state';
import { useReportSchedules, type ScheduleReport } from '@/lib/company/reports';
import { cn } from '@/lib/cn';
import { describeSchedule } from './schedules';

export interface LibraryItem {
  key: string;
  title: string;
  text: string;
  icon: React.ReactNode;
  /** A tab on this page, or a link to a feature page */
  tab?: string;
  href?: string;
  tone: string;
}

const isList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
export function usePinnedReports() {
  return useUiState<string[]>('reports:pinned', [], isList);
}

/** Every report you can open; ★ pinned ones come first (and open first on this page). */
export function ReportLibrary({ items, onTab, canSchedule }: { items: LibraryItem[]; onTab: (tab: string) => void; canSchedule: boolean }) {
  const [pinned, setPinned] = usePinnedReports();
  const schedules = useReportSchedules(canSchedule);
  const sorted = [...items].sort((a, b) => Number(pinned.includes(b.key)) - Number(pinned.includes(a.key)));
  const scheduled = new Map<ScheduleReport, string>();
  for (const s of schedules.data ?? []) if (s.active && !scheduled.has(s.report)) scheduled.set(s.report, describeSchedule(s));
  return (
    <div className="m-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((item) => {
        const on = pinned.includes(item.key);
        const body = (
          <>
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5', item.tone)}>{item.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{item.title}</span>
              <span className="block text-xs text-muted-foreground">{item.text}</span>
              {scheduled.has(item.key as ScheduleReport) && <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary"><Mail className="h-3 w-3" /> {scheduled.get(item.key as ScheduleReport)}</span>}
            </span>
          </>
        );
        return (
          <Card key={item.key} className="m-lift relative flex items-start gap-3 p-4">
            {item.tab ? (
              <button type="button" onClick={() => onTab(item.tab!)} className="flex flex-1 items-start gap-3 text-left">{body}</button>
            ) : (
              <Link href={item.href!} className="flex flex-1 items-start gap-3">{body}</Link>
            )}
            <button type="button" aria-label={on ? `Unpin ${item.title}` : `Pin ${item.title}`} aria-pressed={on} onClick={() => setPinned(on ? pinned.filter((k) => k !== item.key) : [...pinned, item.key])} className={cn('rounded-md p-1 transition-colors', on ? 'text-warning' : 'text-muted-foreground/50 hover:text-warning')}>
              <Star className={cn('h-4 w-4', on && 'fill-current')} />
            </button>
          </Card>
        );
      })}
    </div>
  );
}
