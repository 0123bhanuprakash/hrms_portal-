'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { BarChart3, CalendarRange, Clock, Download, ShieldCheck, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, LoadMore, Skeleton, Tabs } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';

import { StatCard } from '@/components/ui/stat-card';
import { ClaimList } from '@/components/expenses/claim-list';
import { PayDialog } from '@/components/expenses/claim-dialogs';
import { useAccess } from '@/lib/access/use-access';
import { downloadExpensesCsv, money, useClaims, useExpenseBreakdown, useExpenseReport, type Breakdown, type Claim } from '@/lib/company/expenses';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { DateInput } from '@/components/ui/pickers';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function ExpensePaymentsPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const finance = can('expense.finance');
  const allowed = hasFeature('ops.expenses') && (finance || can('expense.hr'));
  const [chosen, setTab] = useState<'pay' | 'report' | null>(null);
  const tab = chosen ?? (finance ? 'pay' : 'report');
  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" description="Payments and reports are for Finance and HR." />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Expenses" title="Payments & reports" description="Approved claims to mark paid, and where the money goes." />
      <Tabs
        tabs={[
          ...(finance ? [{ id: 'pay' as const, label: 'To pay', icon: <Wallet /> }] : []),
          { id: 'report' as const, label: 'Spend report', icon: <BarChart3 /> },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'pay' && finance ? <ToPay /> : <Report />}
    </div>
  );
}

function ToPay() {
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState<Claim | null>(null);
  const list = useClaims({ view: 'payable', page });
  const total = list.data?.data.reduce((s, c) => s + c.totals.approvedPaise, 0) ?? 0;
  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-start gap-3 border-primary/30 bg-primary-soft/30 p-4">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">Payment batches <Badge tone="primary">Coming soon</Badge></p>
          <p className="text-xs text-muted-foreground">Soon you’ll pay everyone’s approved claims in one batch, download the bank file and mark the whole batch paid. For now, pay each claim from your bank and mark it paid here with the reference.</p>
        </div>
      </Card>
      {Boolean(list.data?.data.length) && <p className="text-sm text-muted-foreground">{list.data!.meta.total} claim{list.data!.meta.total === 1 ? '' : 's'} · {money(total)} on this page</p>}
      <ClaimList
        query={list}
        showEmployee
        empty="Nothing to pay right now"
        page={page}
        onPage={setPage}
        action={(c) => c.canPay && <Button size="sm" onClick={() => setPaying(c)}><Wallet /> Mark paid</Button>}
      />
      <PayDialog claim={paying} onClose={() => setPaying(null)} />
    </div>
  );
}

function Report() {
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [exporting, setExporting] = useState(false);
  const report = useExpenseReport({ from, to }, from <= to);
  const r = report.data;

  const [seeAll, setSeeAll] = useState<{ by: Breakdown; title: string } | null>(null);
  const table = (title: string, rows: NonNullable<typeof r>['byCategory'], by: Breakdown) => (
    <Card>
      <CardHeader title={title} action={r!.breakdownCounts[by] > rows.filter((x) => x.key !== '__others').length ? <Button size="sm" variant="ghost" onClick={() => setSeeAll({ by, title })}>See all {r!.breakdownCounts[by]}</Button> : undefined} />
      {!rows.length ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">No spend in this period.</p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {rows.map((row) => {
            const pct = r!.totals.approvedPaise ? Math.round((row.approvedPaise / r!.totals.approvedPaise) * 100) : 0;
            return (
              <li key={row.key} className="px-5 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className={cn('truncate', row.key === '__others' && 'text-muted-foreground')}>{row.label}</span>
                  <span className="font-semibold tabular-nums">{money(row.approvedPaise)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">From<DateInput value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" /></label>
        <label className="text-xs text-muted-foreground">To<DateInput value={to} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" /></label>
        <Button
          variant="secondary"
          className="ml-auto"
          loading={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              await downloadExpensesCsv(from, to);
            } catch (err) {
              toast.error(getApiErrorMessage(err, 'Could not export'));
            } finally {
              setExporting(false);
            }
          }}
        >
          <Download /> Export CSV
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Approved and paid claims, by the date of each expense.</p>
      {report.isLoadingError ? (
        <ErrorState message={getApiErrorMessage(report.error, 'Could not load the report')} onRetry={() => void report.refetch()} />
      ) : from > to ? (
        <EmptyState icon={<CalendarRange />} title="Pick a valid range" description="The start date is after the end date." />
      ) : report.isLoading || !r ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard title="Approved" value={money(r.totals.approvedPaise)} icon={<BarChart3 />} tone="info" />
            <StatCard title="Re-billable to clients" value={money(r.rebillablePaise)} icon={<BarChart3 />} tone="success" />
            <StatCard title="Waiting in approvals" value={money(r.pipeline.waitingPaise)} icon={<Clock />} tone="warning" />
            <StatCard title="Approved, not paid" value={money(r.pipeline.toBePaidPaise)} icon={<Wallet />} tone="primary" />
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader title="By month" description="Approved spend · green part is re-billable to clients" />
              {!r.byMonth.length ? (
                <p className="px-5 pb-5 text-sm text-muted-foreground">No spend in this period.</p>
              ) : (
                <div className="flex h-44 items-end gap-2 px-5 pb-5">
                  {r.byMonth.map((m) => {
                    const max = Math.max(...r.byMonth.map((x) => x.approvedPaise), 1);
                    const h = (m.approvedPaise / max) * 100;
                    const reb = m.approvedPaise ? (m.rebillablePaise / m.approvedPaise) * 100 : 0;
                    const label = new Date(`${m.month}-01T00:00:00Z`).toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });
                    return (
                      <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${label}: ${money(m.approvedPaise)} (${money(m.rebillablePaise)} re-billable)`}>
                        <div className="flex w-full max-w-[44px] flex-col overflow-hidden rounded-t-md" style={{ height: `${Math.max(h, 2)}%` }}>
                          <span className="block bg-success" style={{ height: `${reb}%` }} />
                          <span className="block flex-1 bg-primary" />
                        </div>
                        <span className="text-[11px] text-muted-foreground">{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
            <Card className="space-y-3 p-5">
              <p className="text-sm font-semibold">Exceptions to look at</p>
              {[
                ['Approved over the limit', r.exceptions.overLimit.items, r.exceptions.overLimit.paise, 'danger'],
                ['Amounts lowered', r.exceptions.reduced.items, r.exceptions.reduced.paise, 'warning'],
                ['Items not paid', r.exceptions.rejectedItems.items, r.exceptions.rejectedItems.paise, 'neutral'],
              ].map(([l, n, p, tone]) => (
                <div key={l as string} className="flex items-center gap-2 text-sm">
                  <Badge tone={tone as 'danger' | 'warning' | 'neutral'}>{n as number}</Badge>
                  <span className="flex-1">{l as string}</span>
                  <b className="tabular-nums">{money(p as number)}</b>
                </div>
              ))}
              <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                Sent → approved in <b className="text-foreground">{r.timing.avgDaysToApprove !== null ? `${r.timing.avgDaysToApprove} days` : '—'}</b> on average · approved → paid in <b className="text-foreground">{r.timing.avgDaysToPay !== null ? `${r.timing.avgDaysToPay} days` : '—'}</b>
              </div>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {table('By category', r.byCategory, 'category')}
            {table('By team', r.byDepartment, 'department')}
            {table('By person', r.byEmployee, 'employee')}
            {table('By project', r.byProject, 'project')}
          </div>
        </>
      )}
      {seeAll && <BreakdownDialog from={from} to={to} by={seeAll.by} title={seeAll.title} total={r?.totals.approvedPaise ?? 0} onClose={() => setSeeAll(null)} />}
    </div>
  );
}

/** Every row of one breakdown, 25 at a time. */
function BreakdownDialog({ from, to, by, title, total, onClose }: { from: string; to: string; by: Breakdown; title: string; total: number; onClose: () => void }) {
  const q = useExpenseBreakdown({ from, to, by });
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  return (
    <Modal open onClose={onClose} title={title} icon={<BarChart3 />} size="sm">
      {q.isLoadingError ? (
        <ErrorState message={getApiErrorMessage(q.error, 'Could not load')} onRetry={() => void q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-60" />
      ) : (
        <>
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.key} className="py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{row.label}</span>
                  <span className="font-semibold tabular-nums">{money(row.approvedPaise)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${total ? Math.round((row.approvedPaise / total) * 100) : 0}%` }} /></div>
              </li>
            ))}
          </ul>
          <LoadMore shown={rows.length} total={q.data.pages[0]?.meta.total ?? 0} loading={q.isFetchingNextPage} onMore={() => void q.fetchNextPage()} />
        </>
      )}
    </Modal>
  );
}
