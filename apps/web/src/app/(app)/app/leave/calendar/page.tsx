'use client';

import React, { useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { inputClass } from '@/components/ui/field';
import { useAccess, SCOPE_LABELS } from '@/lib/access/use-access';
import { useDepartments } from '@/lib/company/org';
import { days, leaveRange, useWhosOff, type LeaveRequest } from '@/lib/company/leave';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

const HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const thisMonth = () => new Date().toISOString().slice(0, 7);
const shift = (m: string, by: number) => {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, mo - 1 + by, 1)).toISOString().slice(0, 7);
};
const monthDays = (m: string) => {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  return Array.from({ length: new Date(Date.UTC(y, mo, 0)).getUTCDate() }, (_, i) => `${m}-${String(i + 1).padStart(2, '0')}`);
};

export default function WhosOffPage() {
  const { can, scopeOf, hasFeature, isLoading: accessLoading } = useAccess();
  const scope = scopeOf('leave.view');
  const allowed = hasFeature('time.leave') && can('leave.view') && scope !== 'own';
  const [month, setMonth] = useState(thisMonth);
  const [departmentId, setDepartmentId] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const q = useWhosOff({ month, departmentId: departmentId || undefined }, allowed);
  const departments = useDepartments();

  const keys = useMemo(() => monthDays(month), [month]);
  const byDay = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>();
    for (const l of q.data?.leaves ?? []) for (const k of keys) if (k >= l.startDate && k <= l.endDate) map.set(k, [...(map.get(k) ?? []), l]);
    return map;
  }, [q.data, keys]);
  const holidays = useMemo(() => new Map((q.data?.holidays ?? []).map((h) => [h.date, h])), [q.data]);
  const todayKey = new Date().toISOString().slice(0, 10);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" description="You can only see your own leave." />;
  const lead = (new Date(`${keys[0]}T00:00:00Z`).getUTCDay() + 6) % 7;
  const dayList = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Time" title="Who’s off" description={scope && scope !== 'company' ? `Leave for: ${SCOPE_LABELS[scope].hint.toLowerCase()}.` : 'Approved and pending leave across the company.'} />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="ghost" aria-label="Previous month" onClick={() => { setMonth((m) => shift(m, -1)); setSelected(null); }}><ChevronLeft /></Button>
        <span className="w-40 text-center font-semibold">{new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
        <Button size="icon-sm" variant="ghost" aria-label="Next month" onClick={() => { setMonth((m) => shift(m, 1)); setSelected(null); }}><ChevronRight /></Button>
        <select className={cn(inputClass, 'ml-auto w-56')} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {departments.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-[480px] w-full" />
      ) : q.isError ? (
        <ErrorState message={getApiErrorMessage(q.error, 'Could not load leave')} onRetry={() => q.refetch()} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <Card className="p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1 text-center text-2xs font-medium uppercase tracking-wider text-muted-foreground">
              {HEAD.map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} />)}
              {keys.map((k) => {
                const list = byDay.get(k) ?? [];
                const holiday = holidays.get(k);
                const weekend = [0, 6].includes(new Date(`${k}T00:00:00Z`).getUTCDay());
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelected(k)}
                    className={cn(
                      'flex min-h-[76px] flex-col gap-0.5 rounded-lg border border-transparent p-1.5 text-left transition-colors hover:border-border sm:min-h-[96px]',
                      weekend && 'bg-muted/50',
                      holiday && 'bg-primary-soft/60',
                      selected === k && 'border-primary ring-1 ring-primary',
                    )}
                    aria-label={`${k}: ${list.length} off${holiday ? `, ${holiday.name}` : ''}`}
                  >
                    <span className={cn('text-xs font-semibold tabular-nums', k === todayKey && 'text-primary')}>{Number(k.slice(8))}</span>
                    {holiday && <span className="truncate text-[10px] font-medium text-primary-soft-foreground">{holiday.name}</span>}
                    {list.slice(0, 3).map((l) => (
                      <span
                        key={l.id}
                        className={cn('truncate rounded px-1 text-[10px] font-medium leading-4 text-white', l.status === 'PENDING' && 'opacity-60 ring-1 ring-inset ring-white/60')}
                        style={{ backgroundColor: l.leaveType.color }}
                        title={`${l.employee.firstName} ${l.employee.lastName} · ${l.leaveType.name}${l.status === 'PENDING' ? ' (pending)' : ''}`}
                      >
                        {l.employee.firstName}
                      </span>
                    ))}
                    {list.length > 3 && <span className="text-[10px] text-muted-foreground">+{list.length - 3} more</span>}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Faded chips are waiting for approval.</p>
          </Card>

          <Card className="p-4">
            {!selected ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <CalendarRange className="h-5 w-5" />
                Pick a day to see who’s off.
                <span className="text-xs">{q.data?.leaves.length ?? 0} leave request{q.data?.leaves.length === 1 ? '' : 's'} this month</span>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold">{new Date(`${selected}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</p>
                {holidays.get(selected) && <p className="mt-1 text-xs text-primary">{holidays.get(selected)!.name}</p>}
                {!dayList.length ? (
                  <p className="mt-4 text-sm text-muted-foreground">Nobody is off.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {dayList.map((l) => (
                      <li key={l.id} className="flex items-start gap-2.5 text-sm">
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.leaveType.color }} />
                        <div className="min-w-0">
                          <p className="font-medium">{l.employee.firstName} {l.employee.lastName}</p>
                          <p className="text-xs text-muted-foreground">
                            {l.leaveType.name} · {leaveRange(l)} · {days(l.totalDays)}
                            {l.status === 'PENDING' && ' · pending'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
