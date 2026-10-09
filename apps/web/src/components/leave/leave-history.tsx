'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, FileText, MessageCircleQuestion, Paperclip, RotateCcw, Undo2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { DateInput } from '@/components/ui/pickers';
import { ApprovalChain, CancelRequestNote, Conversation, pretty } from '@/components/leave/request-card';
import { LEAVE_STATUS_TONE, days, leaveRange, openLeaveDocument, useRequestCancel, useWithdrawCancel, type LeaveRequest } from '@/lib/company/leave';
import { formatRelative } from '@/lib/format';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

const addDays = (k: string, n: number) => {
  const d = new Date(`${k}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** One line of the approvals: who is deciding, or who decided. */
function approvalLine(r: LeaveRequest): string {
  if (r.status === 'CANCELLED') return r.cancelledAt ? `Cancelled ${formatRelative(r.cancelledAt)}` : 'Cancelled';
  const acted = [...r.approvals].reverse().find((a) => a.actedBy && (a.status === 'APPROVED' || a.status === 'REJECTED'));
  if (r.status === 'PENDING') {
    const level = r.approvals.find((a) => a.level === r.currentLevel);
    const who = level?.approvers?.length ? level.approvers.map((x) => x.firstName).join(' / ') : 'HR';
    return `Waiting for ${who}${r.requiredLevels > 1 ? ` · ${r.currentLevel} of ${r.requiredLevels}` : ''}`;
  }
  if (!acted?.actedBy) return pretty(r.status);
  return `${r.status === 'APPROVED' ? 'Approved' : 'Rejected'} by ${acted.actedBy.firstName} ${acted.actedBy.lastName}`;
}

/**
 * My leave → history: one compact line per request (type, dates, days, who
 * decides, status, the main action); the line opens for the reason, approvals,
 * questions and cancellation. Lines that need the person open by themselves.
 */
export function LeaveHistoryRow({ r, focused, onCancel, onUpload }: { r: LeaveRequest; focused: boolean; onCancel: (r: LeaveRequest) => void; onUpload: (r: LeaveRequest, f: File) => void }) {
  const needsMe = r.canReply || Boolean(r.needsDocument) || Boolean(r.cancelRequest);
  const [open, setOpen] = useState(focused || needsMe);
  const [asking, setAsking] = useState(false);
  const withdraw = useWithdrawCancel();
  const canAttach = (r.status === 'PENDING' || r.status === 'APPROVED') && !r.document;

  const takeBack = async () => {
    try {
      await withdraw.mutateAsync(r.id);
      toast.success('Cancellation request taken back — your leave stays as approved');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not take it back'));
    }
  };

  // The one thing to do from the line itself
  const main = r.canCancel ? (
    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onCancel(r)}><X /> Cancel</Button>
  ) : r.canRequestCancel ? (
    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setAsking(true)}><RotateCcw /> Request cancellation</Button>
  ) : null;

  return (
    <li id={`leave-${r.id}`} className={cn('scroll-mt-24', focused && 'bg-primary-soft/30')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 lg:grid lg:grid-cols-[minmax(9rem,1fr)_minmax(11rem,1.2fr)_minmax(0,1.1fr)_6.5rem_minmax(8rem,auto)] lg:gap-4">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-w-0 items-center gap-2 text-left">
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')} />
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.leaveType.color }} aria-hidden />
          <span className="truncate text-sm font-medium">{r.leaveType.name}</span>
          {r.questionOpen && <MessageCircleQuestion className="h-3.5 w-3.5 shrink-0 text-warning" aria-label="Question waiting" />}
          {r.needsDocument && <Paperclip className="h-3.5 w-3.5 shrink-0 text-warning" aria-label="Document needed" />}
        </button>
        <span className="whitespace-nowrap text-sm tabular-nums">
          {leaveRange(r)} <span className="text-muted-foreground">· {days(r.totalDays)}</span>
        </span>
        <span className="hidden truncate text-xs text-muted-foreground lg:block">{approvalLine(r)}</span>
        <span className="flex flex-wrap gap-1">
          <Badge tone={LEAVE_STATUS_TONE[r.status]}>{pretty(r.status)}</Badge>
          {r.cancelRequest && <Badge tone="warning">Cancel asked</Badge>}
        </span>
        <span className="ml-auto flex justify-end lg:ml-0">{main}</span>
      </div>

      {open && (
        <div className="space-y-2.5 border-t border-dashed border-border bg-subtle/30 px-4 py-3 pl-11 text-sm">
          <p>“{r.reason}”</p>
          <ApprovalChain r={r} />
          <CancelRequestNote r={r} mine />
          {r.cancelReason && <p className="text-xs text-muted-foreground">Cancelled: {r.cancelReason}</p>}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Applied {formatRelative(r.createdAt)}</span>
            {r.document && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void openLeaveDocument(r.id)}><FileText /> {r.document.name}</Button>}
            {canAttach && (
              <label className={cn('inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 font-medium', r.needsDocument ? 'bg-warning-soft text-warning' : 'hover:bg-subtle')}>
                <Paperclip className="h-3.5 w-3.5" /> {r.needsDocument ? 'Attach the document' : 'Attach a document'}
                <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" onChange={(e) => e.target.files?.[0] && onUpload(r, e.target.files[0])} />
              </label>
            )}
            {r.cancelRequest && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" loading={withdraw.isPending} onClick={() => void takeBack()}><Undo2 /> Take back the request</Button>}
          </div>
          {(r.comments?.length ?? 0) > 0 && <Conversation r={r} />}
        </div>
      )}
      {asking && <CancelRequestDialog r={r} onClose={() => setAsking(false)} />}
    </li>
  );
}

/** Approved leave that has started: cancel all of it, or say you came back early. Whoever approved it decides. */
function CancelRequestDialog({ r, onClose }: { r: LeaveRequest; onClose: () => void }) {
  const ask = useRequestCancel();
  const today = new Date().toISOString().slice(0, 10);
  const multi = r.startDate !== r.endDate;
  const [mode, setMode] = useState<'all' | 'early'>(multi && r.endDate > today ? 'early' : 'all');
  const lastAllowed = addDays(r.endDate, -1);
  const [lastDay, setLastDay] = useState(today < r.startDate ? r.startDate : today > lastAllowed ? lastAllowed : today);
  const [reason, setReason] = useState('');
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ask.mutateAsync({ id: r.id, mode, ...(mode === 'early' && { lastDay }), reason: reason.trim() });
      toast.success('Request sent — you’ll hear once it’s decided');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send the request'));
    }
  };
  const option = (value: 'all' | 'early', title: string, text: string) => (
    <label className={cn('flex cursor-pointer gap-3 rounded-lg border p-3', mode === value ? 'border-primary bg-primary-soft/40' : 'border-border hover:bg-subtle')}>
      <input type="radio" name="cancel-mode" className="mt-1 accent-[hsl(var(--primary))]" checked={mode === value} onChange={() => setMode(value)} />
      <span><span className="block text-sm font-medium">{title}</span><span className="text-xs text-muted-foreground">{text}</span></span>
    </label>
  );
  return (
    <Modal
      open
      onClose={onClose}
      busy={ask.isPending}
      icon={<RotateCcw />}
      title="Request cancellation"
      description={`${r.leaveType.name}, ${leaveRange(r)}. It has already started, so whoever approved it decides. Unused days go back to your balance.`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={ask.isPending}>Keep it</Button>
          <Button type="submit" form="cancel-request-form" loading={ask.isPending} disabled={reason.trim().length < 3}>Send request</Button>
        </>
      }
    >
      <form id="cancel-request-form" onSubmit={send} className="space-y-3">
        {multi && option('early', 'I came back early', 'Keep the days up to my last day off; give the rest back.')}
        {option('all', 'Cancel all of it', 'I didn’t take this leave — give every day back.')}
        {mode === 'early' && (
          <Field label="My last day off" htmlFor="cancel-last-day" hint={`Between ${leaveRange({ startDate: r.startDate, endDate: r.startDate, halfDay: null })} and ${leaveRange({ startDate: lastAllowed, endDate: lastAllowed, halfDay: null })}`}>
            <DateInput id="cancel-last-day" value={lastDay} min={r.startDate} max={lastAllowed} onChange={(e) => setLastDay(e.target.value)} />
          </Field>
        )}
        <Field label="Why" htmlFor="cancel-reason" required>
          <Textarea id="cancel-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="e.g. The trip was cut short" />
        </Field>
      </form>
    </Modal>
  );
}
