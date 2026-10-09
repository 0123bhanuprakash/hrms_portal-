'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Circle, CircleDashed, MessageCircleQuestion, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { getApiErrorMessage } from '@/lib/errors';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { LEAVE_STATUS_TONE, days, leaveRange, useReplyLeave, type LeaveRequest } from '@/lib/company/leave';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

/** `?request=<id>` (from a notification): that card is highlighted and scrolled to once the list has it. */
export function useFocusedRequest(ids: string[] | undefined): string | null {
  const id = useSearchParams().get('request');
  const present = Boolean(id && ids?.includes(id));
  useEffect(() => {
    if (present) document.getElementById(`leave-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [id, present]);
  return present ? id : null;
}

export const pretty = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** Who approved / is deciding each level. */
export function ApprovalChain({ r, className }: { r: LeaveRequest; className?: string }) {
  if (!r.approvals.length) return null;
  return (
    <ol className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs', className)} aria-label="Approvals">
      {r.approvals.map((a) => {
        const pending = a.status === 'PENDING';
        const who = a.actedBy ?? (pending ? null : a.approver);
        const pool = a.approvers?.length ? a.approvers.map((x) => x.firstName).join(' / ') : 'HR';
        const icon =
          a.status === 'APPROVED' ? <Check className="h-3.5 w-3.5 text-success" /> :
          a.status === 'REJECTED' ? <X className="h-3.5 w-3.5 text-destructive" /> :
          a.status === 'SKIPPED' ? <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" /> :
          <Circle className={cn('h-3.5 w-3.5', a.level === r.currentLevel && r.status === 'PENDING' ? 'text-warning' : 'text-muted-foreground')} />;
        return (
          <li key={a.level} className="inline-flex items-center gap-1.5 text-muted-foreground" title={a.comments ?? undefined}>
            {icon}
            <span>
              {who ? `${who.firstName} ${who.lastName}` : pool}
              {a.onBehalfOf && ` (for ${a.onBehalfOf.firstName})`}
              {a.status === 'PENDING' && a.level === r.currentLevel && r.status === 'PENDING' && ' · waiting'}
              {a.comments && ` — “${a.comments}”`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** "Asked to cancel / end early" on approved leave, waiting for a decision. */
export function CancelRequestNote({ r, mine }: { r: LeaveRequest; mine?: boolean }) {
  if (!r.cancelRequest) return null;
  const c = r.cancelRequest;
  return (
    <p className="mt-2 rounded-lg border border-warning/40 bg-warning-soft/60 px-3 py-2 text-xs">
      <b>{mine ? 'You asked' : `${r.employee.firstName} asked`} {c.lastDay ? `to end it early — last day off ${leaveRange({ startDate: c.lastDay, endDate: c.lastDay, halfDay: null })}` : 'to cancel all of it'}</b>
      {c.reason && <> · “{c.reason}”</>}
      <span className="text-muted-foreground"> · {formatRelative(c.requestedAt)}</span>
    </p>
  );
}

/** A leave request with its approval chain and any questions; actions are passed in. `highlight` = opened from a notification. */
export function LeaveRequestCard({ request: r, showEmployee, actions, footer, highlight }: { request: LeaveRequest; showEmployee?: boolean; actions?: React.ReactNode; footer?: React.ReactNode; highlight?: boolean }) {
  return (
    <div id={`leave-${r.id}`} className="scroll-mt-24">
    <Card className={cn('p-4', highlight && 'ring-2 ring-primary/50')}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {showEmployee ? (
            <PersonAvatar person={r.employee} />
          ) : (
            <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: r.leaveType.color }} aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {showEmployee && <>{r.employee.firstName} {r.employee.lastName} <span className="font-normal text-muted-foreground">· </span></>}
              {r.leaveType.name}
              <span className="font-normal text-muted-foreground"> · {days(r.totalDays)}</span>
            </p>
            <p className="text-sm text-muted-foreground">{leaveRange(r)}</p>
            <p className="mt-1 text-sm">“{r.reason}”</p>
            <ApprovalChain r={r} className="mt-2.5" />
            <CancelRequestNote r={r} />
            {r.cancelReason && <p className="mt-1.5 text-xs text-muted-foreground">Cancelled: {r.cancelReason}</p>}
            <p className="mt-1.5 text-xs text-muted-foreground">Applied {formatRelative(r.createdAt)}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
          <Badge tone={LEAVE_STATUS_TONE[r.status]}>{pretty(r.status)}</Badge>
          {r.questionOpen && <Badge tone="warning" className="gap-1"><MessageCircleQuestion className="h-3 w-3" /> {r.canReply ? 'Waiting for your answer' : 'Asked — waiting for reply'}</Badge>}
          {actions}
        </div>
      </div>
      {(r.comments?.length ?? 0) > 0 && <Conversation r={r} />}
      {footer}
    </Card>
    </div>
  );
}

/** Questions from approvers and the person's answers; the person replies here while the request is pending. */
export function Conversation({ r }: { r: LeaveRequest }) {
  const reply = useReplyLeave();
  const [body, setBody] = useState('');
  const send = async () => {
    if (!body.trim() || reply.isPending) return;
    try {
      await reply.mutateAsync({ id: r.id, body: body.trim() });
      setBody('');
      toast.success('Answer sent');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send your answer'));
    }
  };
  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><MessageCircleQuestion className="h-3.5 w-3.5" /> Questions</p>
      <ul className="space-y-2">
        {r.comments.map((c) => (
          <li key={c.id} className={cn('max-w-[85%] rounded-xl px-3 py-2 text-sm', c.kind === 'REPLY' ? 'ml-auto bg-primary-soft text-primary-soft-foreground' : 'bg-subtle')}>
            <p className="text-xs font-medium opacity-75">
              {c.mine ? 'You' : c.author ? `${c.author.firstName} ${c.author.lastName}` : 'Someone'}
              {c.kind === 'QUESTION' ? ' asked' : ' answered'} · {formatRelative(c.createdAt)}
            </p>
            <p className="whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
      </ul>
      {r.canReply && (
        <div className="flex items-end gap-2">
          <Textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            // Enter sends, Shift+Enter adds a new line
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
              e.preventDefault();
              void send();
            }}
            maxLength={1000}
            placeholder={r.questionOpen ? 'Type your answer…' : 'Add something more…'}
            aria-label="Your answer"
            className="min-h-0 flex-1"
          />
          <Button size="sm" loading={reply.isPending} disabled={!body.trim()} onClick={() => void send()}><Send /> Send</Button>
        </div>
      )}
    </div>
  );
}
