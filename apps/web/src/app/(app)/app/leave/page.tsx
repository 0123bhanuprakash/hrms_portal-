'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarPlus, ChevronLeft, ChevronRight, Plane, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Pagination, Skeleton, Tabs } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { BalanceCards } from '@/components/leave/balance-cards';
import { ApplyLeaveDialog } from '@/components/leave/apply-dialog';
import { LeaveRequestCard } from '@/components/leave/request-card';
import { useAccess } from '@/lib/access/use-access';
import { useMyCard } from '@/lib/company/profile';
import { leaveRange, useCancelLeave, useLeaveRequests, type LeaveRequest, type LeaveStatus } from '@/lib/company/leave';
import { getApiErrorMessage } from '@/lib/errors';

export default function MyLeavePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <MyLeave />
    </Suspense>
  );
}

function MyLeave() {
  const params = useSearchParams();
  const router = useRouter();
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const me = useMyCard();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyType, setApplyType] = useState<string | null>(null);
  const [status, setStatus] = useState<'ALL' | LeaveStatus>('ALL');
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<LeaveRequest | null>(null);
  const allowed = hasFeature('time.leave') && can('leave.view');
  const hasProfile = Boolean(me.data?.employee);
  const list = useLeaveRequests({ view: 'mine', status: status === 'ALL' ? undefined : status, page }, allowed && hasProfile);
  const cancel = useCancelLeave();

  // /app/leave?apply=WFH opens the form for that type (home quick actions)
  useEffect(() => {
    const code = params.get('apply');
    if (code !== null) {
      setApplyType(code || null);
      setApplyOpen(true);
      router.replace('/app/leave');
    }
  }, [params, router]);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="Leave isn’t available" description="Leave isn’t enabled for you." />;
  if (me.isSuccess && !hasProfile) return <EmptyState icon={<Plane />} title="No employee profile" description="Leave needs an employee profile. Ask an admin to add one for your account." />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Time"
        title="My leave"
        description="Balances, requests and approvals."
        action={can('leave.request') && <Button onClick={() => { setApplyType(null); setApplyOpen(true); }}><CalendarPlus /> Apply for leave</Button>}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Balances</h2>
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="ghost" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}><ChevronLeft /></Button>
            <span className="w-12 text-center text-sm font-medium tabular-nums">{year}</span>
            <Button size="icon-sm" variant="ghost" aria-label="Next year" onClick={() => setYear((y) => y + 1)} disabled={year > new Date().getFullYear()}><ChevronRight /></Button>
          </div>
        </div>
        {hasProfile && <BalanceCards year={year} />}
      </section>

      <section className="space-y-3">
        <Tabs
          tabs={[
            { id: 'ALL' as const, label: 'All requests' },
            { id: 'PENDING' as const, label: 'Pending' },
            { id: 'APPROVED' as const, label: 'Approved' },
            { id: 'REJECTED' as const, label: 'Rejected' },
            { id: 'CANCELLED' as const, label: 'Cancelled' },
          ]}
          value={status}
          onChange={(s) => { setStatus(s); setPage(1); }}
        />
        {list.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
        ) : list.isError ? (
          <ErrorState message={getApiErrorMessage(list.error, 'Could not load your requests')} onRetry={() => list.refetch()} />
        ) : !list.data?.data.length ? (
          <EmptyState icon={<Plane />} title="No leave requests" description={status === 'ALL' ? 'When you apply for leave it will show up here.' : undefined} />
        ) : (
          <div className="space-y-3">
            {list.data.data.map((r) => (
              <LeaveRequestCard
                key={r.id}
                request={r}
                actions={r.canCancel && <Button size="sm" variant="ghost" onClick={() => setCancelling(r)}>Cancel request</Button>}
              />
            ))}
            <Pagination page={page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />
          </div>
        )}
      </section>

      <ApplyLeaveDialog open={applyOpen} onClose={() => setApplyOpen(false)} initialTypeCode={applyType} />
      <ConfirmDialog
        isOpen={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        isLoading={cancel.isPending}
        title="Cancel this leave?"
        description={cancelling ? `${cancelling.leaveType.name}, ${leaveRange(cancelling)}. The days go back to your balance.` : ''}
        confirmText="Cancel leave"
        cancelText="Keep it"
        isDanger
        onConfirm={async () => {
          if (!cancelling) return;
          try {
            await cancel.mutateAsync({ id: cancelling.id });
            toast.success('Leave cancelled');
            setCancelling(null);
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not cancel'));
          }
        }}
      />
    </div>
  );
}
