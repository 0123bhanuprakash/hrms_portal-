'use client';

import React from 'react';
import { ArrowDown, ArrowUp, Clock, Lightbulb, Plane, Users } from 'lucide-react';
import { Card, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { CountUp } from '@/components/motion/motion';
import { Spark } from '@/components/super-admin/company-insights';
import { useReportsOverview, monthLabel, type Highlight, type Kpi, type ReportsOverview } from '@/lib/company/reports';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { Delta, shortDate, type ReportParams } from './filters';

const HL: Record<Highlight['tone'], string> = {
  good: 'bg-success-soft text-success',
  bad: 'bg-destructive-soft text-destructive',
  warn: 'bg-warning-soft text-warning',
  info: 'bg-primary-soft text-primary-soft-foreground',
};
const HL_ICON: Record<Highlight['icon'], React.ReactNode> = { up: <ArrowUp />, down: <ArrowDown />, leave: <Plane />, people: <Users />, clock: <Clock /> };
const TAB_LABEL: Record<Highlight['tab'], string> = { people: 'See people', attendance: 'See attendance', utilisation: 'See utilisation' };

function KpiTile({ label, kpi, unit = '', format = (n: number) => String(n), goodWhenUp = true, series, tone }: { label: string; kpi: Kpi; unit?: string; format?: (n: number) => string; goodWhenUp?: boolean; series: Array<number | null>; tone: string }) {
  const s = series.filter((v): v is number => v !== null);
  return (
    <Card className="m-lift relative flex flex-col gap-1 overflow-hidden p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-[26px] font-bold leading-none tracking-tight">{kpi.value === null ? '—' : typeof kpi.value === 'number' && !unit && Number.isInteger(kpi.value) ? <CountUp value={kpi.value} /> : `${format(kpi.value)}${unit}`}</span>
      <Delta change={kpi.change} unit={unit === '%' ? ' pts' : ''} goodWhenUp={goodWhenUp} />
      {s.length > 1 && <Spark values={s} className={cn('absolute bottom-3 right-3', tone)} width={78} height={26} />}
    </Card>
  );
}

function Bridge({ b }: { b: ReportsOverview['bridge'] }) {
  const steps = [
    { label: 'Start', value: b.start, base: 0, cls: 'fill-muted-foreground/30' },
    { label: 'Joined', value: b.joined, base: b.start, cls: 'fill-success' },
    { label: 'Left', value: b.left, base: b.start + b.joined - b.left, cls: 'fill-destructive' },
    { label: 'Now', value: b.end, base: 0, cls: 'fill-primary' },
  ];
  const top = Math.max(1, b.start + b.joined, b.end) * 1.15;
  const H = 150;
  const y = (v: number) => H - (v / top) * H;
  return (
    <svg viewBox={`0 0 400 ${H + 30}`} className="h-44 w-full" role="img" aria-label={`Headcount went from ${b.start} to ${b.end}: ${b.joined} joined, ${b.left} left`}>
      <line x1="8" x2="392" y1={H} y2={H} className="stroke-border" />
      {steps.map((s, i) => {
        const x = 24 + i * 95;
        const yTop = y(s.base + s.value);
        const h = Math.max(2, (s.value / top) * H);
        return (
          <g key={s.label}>
            <rect x={x} y={yTop} width={60} height={h} rx={6} className={cn(s.cls, 'm-rise')} style={{ transformOrigin: `${x + 30}px ${H}px` }} />
            <text x={x + 30} y={yTop - 6} textAnchor="middle" className="fill-foreground text-[13px] font-extrabold">{i === 1 && s.value ? '+' : i === 2 && s.value ? '−' : ''}{s.value}</text>
            <text x={x + 30} y={H + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">{s.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function OverviewTab({ params, onTab }: { params: ReportParams; onTab: (tab: string) => void }) {
  const q = useReportsOverview({ from: params.from, to: params.to, departmentId: params.departmentId, locationId: params.locationId });
  if (q.isLoadingError) return <ErrorState message={getApiErrorMessage(q.error, 'Could not load the overview')} onRetry={() => void q.refetch()} />;
  const o = q.data;
  if (!o) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }
  const m = o.monthly;
  return (
    <div className={cn('space-y-4 transition-opacity', q.isFetching && 'opacity-70')}>
      <p className="text-xs text-muted-foreground">
        {shortDate(o.from)} – {shortDate(o.to)} compared with {shortDate(o.previous.from)} – {shortDate(o.previous.to)} · trend lines show the last 7 months
      </p>
      <div className={cn('m-stagger grid grid-cols-2 gap-3', o.kpis.billablePct ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
        <KpiTile label="Headcount" kpi={o.kpis.headcount} series={m.map((x) => x.headcount)} tone="text-primary" />
        <KpiTile label="Attendance rate" kpi={o.kpis.attendanceRatePct} unit="%" series={m.map((x) => x.attendanceRatePct)} tone="text-success" />
        <KpiTile label="Leave days taken" kpi={o.kpis.leaveDays} goodWhenUp={false} series={m.map((x) => x.leaveDays)} tone="text-warning" />
        <KpiTile label="Attrition · 12 months" kpi={o.kpis.attritionPct} unit="%" goodWhenUp={false} series={m.map((x) => x.attritionPct)} tone="text-destructive" />
        {o.kpis.billablePct && <KpiTile label="Billable time" kpi={o.kpis.billablePct} unit="%" series={m.map((x) => x.billablePct)} tone="text-info" />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="h-4 w-4 text-muted-foreground" /> What changed
            <span className="ml-auto text-xs font-normal text-muted-foreground">found in your data</span>
          </h2>
          {o.highlights.length ? (
            <div className="m-stagger grid gap-2.5 sm:grid-cols-2">
              {o.highlights.map((h) => (
                <button key={h.key} type="button" onClick={() => onTab(h.tab)} className="m-lift flex items-start gap-3 rounded-xl border border-border bg-surface p-3 text-left">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4', HL[h.tone])}>{HL_ICON[h.icon]}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{h.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{h.detail}</span>
                    <span className="mt-1.5 block text-xs font-semibold text-primary">{TAB_LABEL[h.tab]} →</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing unusual in this period.</p>
          )}
        </Card>

        <Card className="flex flex-col gap-2 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-muted-foreground" /> Headcount in this period
            <span className="ml-auto text-xs font-normal text-muted-foreground">{o.bridge.start} → {o.bridge.end}</span>
          </h2>
          <Bridge b={o.bridge} />
          <div className="space-y-1.5 text-xs">
            {o.bridge.joiners.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5"><b className="text-success">+{o.bridge.joined} joined</b>{o.bridge.joiners.slice(0, 6).map((p) => <span key={p.id} className="flex items-center gap-1"><PersonAvatar person={p} size="xs" />{p.firstName}</span>)}</p>
            )}
            {o.bridge.leavers.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5"><b className="text-destructive">−{o.bridge.left} left</b>{o.bridge.leavers.slice(0, 6).map((p) => <span key={p.id} className="flex items-center gap-1"><PersonAvatar person={p} size="xs" />{p.firstName}</span>)}</p>
            )}
            {o.bridge.upcoming.length > 0 && <p className="text-muted-foreground">{o.bridge.upcoming.length} more joining in the next two weeks</p>}
            {!o.bridge.joined && !o.bridge.left && <p className="text-muted-foreground">Nobody joined or left in this period.</p>}
          </div>
        </Card>
      </div>
      <p className="text-[11px] text-muted-foreground">Months: {m.map((x) => monthLabel(x.month)).join(' · ')}</p>
    </div>
  );
}
