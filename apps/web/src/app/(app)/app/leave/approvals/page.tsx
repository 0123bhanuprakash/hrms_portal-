'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Check, Inbox, List, ShieldCheck, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Pagination, Skeleton, Tabs } from '@/components/ui/feedback';
import { Field, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { LeaveRequestCard } from '@/components/leave/request-card';
import { useAccess } from '@/lib/access/use-access';
import { leaveRange, useDecideLeave, useLeaveRequests, type LeaveRequest, type LeaveStatus } from '@/lib/company/leave';
import { getApiErrorMessage } from '@/lib/errors';

type View = 'review' | 'all';

export default function LeaveApprovalsPage() {
  const { can, scopeOf, access, hasFeature, isLoading: accessLoading } = useAccess();
  const delegated = access?.delegations.filter((d) => d.permissions.includes('leave.approve')) ?? [];
  const approver = can('leave.approve') || delegated.length > 0;
  const canSeeAll = can('leave.view') && scopeOf('leave.view') !== 'own';
  const allowed = hasFeature('time.leave') && (approver || canSeeAll);
  // Default tab follows access once it has loaded (approvers start on their queue)
  const [chosen, setView] = useState<View | null>(null);
  const view: View = chosen ?? (approver ? 'review' : 'all');
  const [status, setStatus] = useState<LeaveStatus | ''>('');
  const [page, setPage] = useState(1);
  const [deciding, setDeciding] = useState<{ request: LeaveRequest; action: 'approve' | 'reject' } | null>(null);
  const list = useLeaveRequests({ view, status: view === 'all' && status ? status : undefined, page }, allowed);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" description="You don’t approve or review leave." />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Time" title="Leave approvals" description="Requests waiting for your decision, and leave across the people you look after." />

      {delegated.length > 0 && (
        <p className="rounded-lg border border-border bg-subtle/60 px-4 py-3 text-sm text-muted-foreground">
          You are covering leave approvals for {delegated.map((d) => d.fromName).join(', ')} — your decisions are recorded on their behalf.
        </p>
      )}

      <Tabs
        tabs={[
          ...(approver ? [{ id: 'review' as const, label: 'Waiting for me', icon: <Inbox />, ...(view === 'review' && list.data && { count: list.data.meta.total }) }] : []),
          ...(canSeeAll ? [{ id: 'all' as const, label: 'All requests', icon: <List /> }] : []),
        ]}
        value={view}
        onChange={(v) => { setView(v); setPage(1); }}
      />

      {view === 'all' && (
        <div className="flex flex-wrap gap-1.5">
          {(['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((s) => (
            <Button key={s || 'any'} size="sm" variant={status === s ? 'soft' : 'ghost'} onClick={() => { setStatus(s); setPage(1); }}>
              {s ? s.charAt(0) + s.slice(1).toLowerCase() : 'Any status'}
            </Button>
          ))}
        </div>
      )}

      {list.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : list.isError ? (
        <ErrorState message={getApiErrorMessage(list.error, 'Could not load requests')} onRetry={() => list.refetch()} />
      ) : !list.data?.data.length ? (
        <EmptyState icon={<Inbox />} title={view === 'review' ? 'All caught up' : 'No leave requests'} description={view === 'review' ? 'Nothing is waiting for you.' : undefined} />
      ) : (
        <div className="space-y-3">
          {list.data.data.map((r) => (
            <LeaveRequestCard
              key={r.id}
              request={r}
              showEmployee
              actions={
                r.canDecide && (
                  <div className="flex flex-col items-start gap-1.5 md:items-end">
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setDeciding({ request: r, action: 'reject' })}><X /> Reject</Button>
                      <Button size="sm" onClick={() => setDeciding({ request: r, action: 'approve' })}><Check /> Approve</Button>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {r.requiredLevels > 1 && `Level ${r.currentLevel} of ${r.requiredLevels}`}
                      {r.decideAs === 'delegate' && ' · covering'}
                      {r.decideAs === 'override' && ' · as HR (final)'}
                    </span>
                  </div>
                )
              }
            />
          ))}
          <Pagination page={page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />
        </div>
      )}

      <DecideDialog value={deciding} onClose={() => setDeciding(null)} />
    </div>
  );
}

function DecideDialog({ value, onClose }: { value: { request: LeaveRequest; action: 'approve' | 'reject' } | null; onClose: () => void }) {
  const decide = useDecideLeave();
  const [note, setNote] = useState('');
  if (!value) return null;
  const { request: r, action } = value;
  const submit = async () => {
    try {
      const res = await decide.mutateAsync({ id: r.id, action, note });
      toast.success(action === 'reject' ? 'Leave rejected' : res.status === 'APPROVED' ? 'Leave approved' : `Approved — now with level ${res.currentLevel}`);
      setNote('');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save the decision'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={decide.isPending}
      icon={action === 'approve' ? <Check /> : <X />}
      title={`${action === 'approve' ? 'Approve' : 'Reject'} ${r.employee.firstName}’s ${r.leaveType.name.toLowerCase()}?`}
      description={`${leaveRange(r)} · ${r.totalDays} day${r.totalDays === 1 ? '' : 's'}`}
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={decide.isPending}>Cancel</Button>
          <Button variant={action === 'approve' ? 'primary' : 'danger'} onClick={submit} loading={decide.isPending}>{action === 'approve' ? 'Approve' : 'Reject'}</Button>
        </>
      }
    >
      <Field label={action === 'approve' ? 'Note (optional)' : 'Reason (optional)'} htmlFor="lv-note">
        <Textarea id="lv-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
      </Field>
    </Modal>
  );
}
