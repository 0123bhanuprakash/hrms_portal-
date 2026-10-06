'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Search, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { Input, inputClass } from '@/components/ui/field';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { TS_STATUS, addDays, fmtHours, mondayOf, todayKey, useCompliance, weekLabel } from '@/lib/company/timesheets';
import { getApiErrorMessage } from '@/lib/errors';
import { Select } from '@/components/ui/pickers';

/** Who in my scope has (not) filled a week. */
export function Compliance() {
  const lastWeek = addDays(mondayOf(todayKey()), -7);
  const [week, setWeek] = useState(lastWeek);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const q = useCompliance({ weekStart: week, status: status || undefined, search: debounced || undefined, page });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="secondary" aria-label="Previous week" onClick={() => { setWeek(addDays(week, -7)); setPage(1); }}><ChevronLeft /></Button>
        <span className="min-w-[150px] text-center text-sm font-semibold">{weekLabel(week)}</span>
        <Button size="icon-sm" variant="secondary" aria-label="Next week" disabled={week >= mondayOf(todayKey())} onClick={() => { setWeek(addDays(week, 7)); setPage(1); }}><ChevronRight /></Button>
        <Select className={`${inputClass} w-auto`} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
          <option value="">Everyone</option>
          <option value="missing">Not started</option>
          <option value="DRAFT">Not sent</option>
          <option value="SUBMITTED">Waiting for approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Sent back</option>
        </Select>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or employee ID…" className="pl-9" aria-label="Search people" />
        </div>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : q.isError ? (
        <ErrorState message={getApiErrorMessage(q.error, 'Could not load')} onRetry={() => void q.refetch()} />
      ) : !q.data?.data.length ? (
        <EmptyState icon={<UserX />} title="Nobody here" />
      ) : (
        <>
          <Card className="divide-y divide-border">
            {q.data.data.map(({ employee: e, timesheet: t }) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <PersonAvatar person={e} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.firstName} {e.lastName}</p>
                  <p className="truncate text-xs text-muted-foreground">{[e.designation?.name, e.department?.name].filter(Boolean).join(' · ') || e.employeeId}</p>
                </div>
                {t && <span className="tabular-nums text-muted-foreground">{fmtHours(t.totalMinutes)}</span>}
                {t ? (
                  <Link href={`/app/timesheets?week=${week}&employeeId=${e.id}`}><Badge tone={TS_STATUS[t.status].tone}>{TS_STATUS[t.status].label}</Badge></Link>
                ) : (
                  <Badge tone="danger">Not started</Badge>
                )}
              </div>
            ))}
          </Card>
          <Pagination page={page} totalPages={q.data.meta.totalPages} total={q.data.meta.total} limit={q.data.meta.limit} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
