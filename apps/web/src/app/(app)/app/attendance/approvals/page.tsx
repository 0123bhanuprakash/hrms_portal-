'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, Check, ClipboardCheck, Inbox, ShieldCheck, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Pagination, Skeleton, Tabs } from '@/components/ui/feedback';
import { Field, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { useAccess } from '@/lib/access/use-access';
import { CORRECTION_TONE, STATUS_META, clock, dayLabel, useCorrections, useReviewCorrection, type Correction, type CorrectionStatus } from '@/lib/company/attendance';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';

export default function AttendanceApprovalsPage() {
  const { can, access, hasFeature, isLoading: accessLoading } = useAccess();
  const delegated = access?.delegations.filter((d) => d.permissions.includes('attendance.approve')) ?? [];
  const allowed = hasFeature('time.attendance') && (can('attendance.approve') || delegated.length > 0);
  const [status, setStatus] = useState<CorrectionStatus>('PENDING');
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<Correction | null>(null);
  const list = useCorrections({ view: 'review', status, page }, allowed);
  const review = useReviewCorrection();

  if (!accessLoading && !allowed) {
    return <EmptyState icon={<ShieldCheck />} title="No approvals" description="You don’t approve attendance corrections." />;
  }
  const tz = list.data?.meta.timeZone ?? 'Asia/Kolkata';

  const approve = async (c: Correction) => {
    try {
      await review.mutateAsync({ id: c.id, action: 'approve' });
      toast.success(`Approved ${c.employee.firstName}’s correction for ${dayLabel(c.date)}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not approve'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Time" title="Attendance approvals" description="Correction requests from people you approve for. Approved times replace what is on record." />

      {delegated.length > 0 && (
        <p className="rounded-lg border border-border bg-subtle/60 px-4 py-3 text-sm text-muted-foreground">
          You are also covering approvals for {delegated.map((d) => d.fromName).join(', ')}. Decisions you make for their team are recorded as on their behalf.
        </p>
      )}

      <Tabs
        tabs={[
          { id: 'PENDING' as const, label: 'Pending', icon: <Inbox />, ...(status === 'PENDING' && list.data && { count: list.data.meta.total }) },
          { id: 'APPROVED' as const, label: 'Approved', icon: <Check /> },
          { id: 'REJECTED' as const, label: 'Rejected', icon: <X /> },
        ]}
        value={status}
        onChange={(s) => { setStatus(s); setPage(1); }}
      />

      {list.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : list.isError ? (
        <ErrorState message={getApiErrorMessage(list.error, 'Could not load requests')} onRetry={() => list.refetch()} />
      ) : !list.data?.data.length ? (
        <EmptyState icon={<ClipboardCheck />} title={status === 'PENDING' ? 'All caught up' : 'Nothing here yet'} description={status === 'PENDING' ? 'No corrections are waiting for you.' : undefined} />
      ) : (
        <div className="space-y-3">
          {list.data.data.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <PersonAvatar person={c.employee} />
                  <div className="min-w-0">
                    <p className="font-medium">
                      {c.employee.firstName} {c.employee.lastName} <span className="font-normal text-muted-foreground">· {dayLabel(c.date, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {c.current?.checkIn ? `${clock(c.current.checkIn, tz)}–${clock(c.current.checkOut, tz)}` : c.current ? STATUS_META[c.current.status].label : 'No record'}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium tabular-nums">{clock(c.checkIn, tz)}–{clock(c.checkOut, tz)}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">“{c.reason}”</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Requested {formatRelative(c.createdAt)}
                      {c.reviewedBy && ` · ${c.status.toLowerCase()} by ${c.reviewedBy.firstName} ${c.reviewedBy.lastName}`}
                      {c.onBehalfOf && ` on behalf of ${c.onBehalfOf.firstName} ${c.onBehalfOf.lastName}`}
                      {c.reviewNote && ` — “${c.reviewNote}”`}
                    </p>
                  </div>
                </div>
                {c.status === 'PENDING' ? (
                  <div className="flex shrink-0 gap-2">
                    <Button variant="secondary" onClick={() => setRejecting(c)} disabled={review.isPending}><X /> Reject</Button>
                    <Button onClick={() => approve(c)} loading={review.isPending && review.variables?.id === c.id && review.variables.action === 'approve'}><Check /> Approve</Button>
                  </div>
                ) : (
                  <Badge tone={CORRECTION_TONE[c.status]}>{c.status.charAt(0) + c.status.slice(1).toLowerCase()}</Badge>
                )}
              </div>
            </Card>
          ))}
          <Pagination page={page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />
        </div>
      )}

      <RejectDialog correction={rejecting} onClose={() => setRejecting(null)} />
    </div>
  );
}

function RejectDialog({ correction, onClose }: { correction: Correction | null; onClose: () => void }) {
  const review = useReviewCorrection();
  const [note, setNote] = useState('');
  if (!correction) return null;
  const submit = async () => {
    try {
      await review.mutateAsync({ id: correction.id, action: 'reject', note });
      toast.success('Request rejected');
      setNote('');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not reject'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={review.isPending}
      icon={<X />}
      title={`Reject ${correction.employee.firstName}’s correction?`}
      description="They will see your note."
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={review.isPending}>Cancel</Button>
          <Button variant="danger" onClick={submit} loading={review.isPending}>Reject</Button>
        </>
      }
    >
      <Field label="Note (optional)" htmlFor="rej-note">
        <Textarea id="rej-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="e.g. The office log shows you arrived at 11:00" />
      </Field>
    </Modal>
  );
}
