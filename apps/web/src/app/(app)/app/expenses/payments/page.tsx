'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { BarChart3, Download, ShieldCheck, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, EmptyState, Skeleton, Tabs } from '@/components/ui/feedback';
import { Input } from '@/components/ui/field';
import { StatCard } from '@/components/ui/stat-card';
import { ClaimList } from '@/components/expenses/claim-list';
import { PayDialog } from '@/components/expenses/claim-dialogs';
import { useAccess } from '@/lib/access/use-access';
import { downloadExpensesCsv, money, useClaims, useExpenseReport, type Claim } from '@/lib/company/expenses';
import { getApiErrorMessage } from '@/lib/errors';

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
      <PageHeader eyebrow="Expenses" title="Payments & reports" description="Approved claims waiting to be paid, and spend by category, person and project." />
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

  const table = (title: string, rows: NonNullable<typeof r>['byCategory']) => (
    <Card>
      <CardHeader title={title} />
      {!rows.length ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">No spend in this period.</p>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {rows.map((row) => {
            const pct = r!.totals.approvedPaise ? Math.round((row.approvedPaise / r!.totals.approvedPaise) * 100) : 0;
            return (
              <li key={row.key} className="px-5 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{row.label}</span>
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
        <label className="text-xs text-muted-foreground">From<Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" /></label>
        <label className="text-xs text-muted-foreground">To<Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" /></label>
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
      {report.isLoading || !r ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard title="Claimed" value={money(r.totals.claimedPaise)} icon={<BarChart3 />} tone="neutral" />
            <StatCard title="Approved" value={money(r.totals.approvedPaise)} icon={<BarChart3 />} tone="info" />
            <StatCard title="Paid" value={money(r.totals.paidPaise)} icon={<Wallet />} tone="success" />
            <StatCard title="Items" value={r.totals.items} icon={<BarChart3 />} tone="primary" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {table('By category', r.byCategory)}
            {table('By person', r.byEmployee)}
            {table('By project', r.byProject)}
          </div>
        </>
      )}
    </div>
  );
}
