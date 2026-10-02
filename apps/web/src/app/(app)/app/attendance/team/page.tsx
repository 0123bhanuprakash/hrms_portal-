'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Pencil, Search, ShieldCheck, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { Input, inputClass } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { CorrectionDialog } from '@/components/attendance/correction-dialog';
import { useAccess, SCOPE_LABELS } from '@/lib/access/use-access';
import { useDepartments } from '@/lib/company/org';
import { STATUS_META, clock, dayLabel, downloadAttendanceCsv, hours, usePolicy, useTeamAttendance, type TeamDay } from '@/lib/company/attendance';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type Row = TeamDay['data'][number];

export default function TeamAttendancePage() {
  const { can, scopeOf, hasFeature, isLoading: accessLoading } = useAccess();
  const [date, setDate] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Row | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, departmentId, status, date]);

  const scope = scopeOf('attendance.view');
  const allowed = hasFeature('time.attendance') && can('attendance.view') && scope !== 'own';
  const team = useTeamAttendance({ date, search: debounced || undefined, departmentId: departmentId || undefined, status: status || undefined, page, limit: 50 });
  const policy = usePolicy(allowed);
  const departments = useDepartments();
  const tz = policy.data?.timeZone ?? 'Asia/Kolkata';
  const data = team.data;
  const day = data?.date;

  if (!accessLoading && !allowed) {
    return <EmptyState icon={<ShieldCheck />} title="No access" description="You can only see your own attendance." />;
  }

  const chips: Array<{ id: string; label: string; count: number | undefined }> = [
    { id: '', label: 'Everyone', count: data?.counts.total },
    { id: 'PRESENT', label: 'Present', count: data?.counts.present },
    { id: 'WORKING', label: 'Checked in', count: data?.counts.working },
    { id: 'LATE', label: 'Late', count: data?.counts.late },
    { id: 'HALF_DAY', label: 'Half day', count: data?.counts.halfDay },
    { id: 'NOT_CHECKED_IN', label: 'Not checked in', count: data?.counts.notCheckedIn },
    { id: 'ABSENT', label: 'Absent', count: data?.counts.absent },
    { id: 'MISSING_CHECKOUT', label: 'Missing check-out', count: data?.counts.missingCheckout },
    { id: 'ON_LEAVE', label: 'On leave', count: data?.counts.onLeave },
    { id: 'WORK_FROM_HOME', label: 'Work from home', count: data?.counts.workFromHome },
  ];

  const exportCsv = async () => {
    if (!day) return;
    setExporting(true);
    try {
      await downloadAttendanceCsv(day.slice(0, 7), departmentId || undefined);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not export'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Time"
        title="Team attendance"
        description={scope && scope !== 'company' ? `Showing: ${SCOPE_LABELS[scope].hint.toLowerCase()}.` : 'Everyone in the company.'}
        action={
          can('attendance.export') && (
            <Button variant="secondary" onClick={exportCsv} loading={exporting} disabled={!day}>
              <Download /> Export {day ? new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''}
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Previous day" onClick={() => day && setDate(addDays(day, -1))}><ChevronLeft /></Button>
          <Input type="date" value={day ?? ''} max={data?.today} onChange={(e) => setDate(e.target.value || undefined)} className="w-40" aria-label="Date" />
          <Button size="icon-sm" variant="ghost" aria-label="Next day" onClick={() => day && setDate(addDays(day, 1))} disabled={!day || day >= (data?.today ?? '')}><ChevronRight /></Button>
          {day && data && day !== data.today && <Button size="sm" variant="ghost" onClick={() => setDate(undefined)}>Today</Button>}
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, email or ID" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" aria-label="Search" />
        </div>
        <select className={cn(inputClass, 'lg:w-52')} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {departments.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.id || 'all'}
            type="button"
            onClick={() => setStatus(c.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              status === c.id ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border text-muted-foreground hover:bg-subtle',
            )}
          >
            {c.label}
            <span className="tabular-nums">{c.count ?? '–'}</span>
          </button>
        ))}
      </div>

      {data?.holiday && <p className="rounded-lg bg-primary-soft px-4 py-2.5 text-sm text-primary-soft-foreground">{dayLabel(data.date)} is a holiday: {data.holiday.name}</p>}

      <Card className="overflow-hidden">
        {team.isLoading ? (
          <div className="space-y-2 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : team.isError ? (
          <ErrorState message={getApiErrorMessage(team.error, 'Could not load attendance')} onRetry={() => team.refetch()} />
        ) : !data?.data.length ? (
          <EmptyState icon={<Users />} title="No one here" description="Try another day, filter or search." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-subtle/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="hidden px-4 py-3 font-semibold sm:table-cell">In</th>
                    <th className="hidden px-4 py-3 font-semibold sm:table-cell">Out</th>
                    <th className="hidden px-4 py-3 font-semibold md:table-cell">Worked</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.map((r) => {
                    const meta = STATUS_META[r.status];
                    return (
                      <tr key={r.employee.id} className="hover:bg-muted/40">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <PersonAvatar person={r.employee} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{r.employee.firstName} {r.employee.lastName}</p>
                              <p className="truncate text-xs text-muted-foreground">{r.employee.designation?.name ?? r.employee.employeeId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone={meta.tone} dot>{meta.label}</Badge>
                            {(r.lateMinutes ?? 0) > 0 && <Badge tone="warning">Late {r.lateMinutes}m</Badge>}
                            {r.isManualEntry && <Badge tone="outline">Corrected</Badge>}
                            {r.leave && (
                              <Badge tone="outline" title={r.leave.status === 'PENDING' ? 'Waiting for approval' : undefined}>
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.leave.color }} />
                                {r.leave.name}{r.leave.halfDay ? ' (½)' : ''}{r.leave.status === 'PENDING' ? ' · pending' : ''}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="hidden px-4 py-2.5 tabular-nums sm:table-cell">{clock(r.checkIn, tz)}</td>
                        <td className="hidden px-4 py-2.5 tabular-nums sm:table-cell">{clock(r.checkOut, tz)}</td>
                        <td className="hidden px-4 py-2.5 md:table-cell">{hours(r.workingMinutes)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon-sm" variant="ghost" asChild aria-label={`Month view for ${r.employee.firstName}`}>
                              <Link href={`/app/attendance?employee=${r.employee.id}`}><CalendarDays /></Link>
                            </Button>
                            {can('attendance.edit') && scopeOf('attendance.edit') && (
                              <Button size="icon-sm" variant="ghost" aria-label={`Edit ${r.employee.firstName}'s day`} onClick={() => setEditing(r)}>
                                <Pencil />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data.meta.totalPages} total={data.meta.total} limit={data.meta.limit} onPageChange={setPage} />
          </>
        )}
      </Card>

      {editing && day && (
        <CorrectionDialog
          mode="edit"
          day={{ date: day, checkIn: editing.checkIn, checkOut: editing.checkOut, notes: null }}
          timeZone={tz}
          employeeId={editing.employee.id}
          employeeName={`${editing.employee.firstName} ${editing.employee.lastName}`}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
