'use client';

import React from 'react';
import { Check, Clock, MessageCircleQuestion, Minus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FLAG_LABEL, STAGE_LABEL, type Claim, type ClaimFlag } from '@/lib/company/expenses';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

type StepState = 'done' | 'now' | 'todo' | 'back' | 'skip' | 'ask';
interface Step {
  key: string;
  label: string;
  who: string;
  state: StepState;
}

/** Sent → manager → Finance → HR → paid, with who and when. */
export function claimSteps(c: Claim): Step[] {
  if (c.status === 'DRAFT') return [];
  const out: Step[] = [{ key: 'sent', label: 'Sent', who: c.submittedAt ? formatRelative(c.submittedAt) : '', state: 'done' }];
  const manager = c.steps.find((s) => s.stage === 'MANAGER');
  const managerDone = !manager || manager.status !== 'PENDING';
  for (const s of c.steps) {
    const current = c.status === 'PENDING' && s.status === 'PENDING' && (s.stage === 'MANAGER' || managerDone);
    const asked = current && c.questionOpen;
    const names = s.approvers.map((a) => a.firstName).join(' / ');
    out.push({
      key: s.stage,
      label: s.stage === 'MANAGER' ? (s.label?.split(' · ')[0] ?? 'Manager') : STAGE_LABEL[s.stage],
      who:
        s.status === 'APPROVED' || s.status === 'REJECTED'
          ? `${s.actedBy?.firstName ?? ''} ${s.status === 'APPROVED' ? '✓' : 'sent back'}${s.actedAt ? ` · ${formatRelative(s.actedAt)}` : ''}`
          : s.status === 'SKIPPED'
            ? s.stage === 'MANAGER' ? 'no manager' : 'not needed'
            : asked
              ? 'asked a question'
              : current
                ? `with ${s.stage === 'MANAGER' ? names || 'a manager' : STAGE_LABEL[s.stage]}`
                : 'next',
      state: s.status === 'APPROVED' ? 'done' : s.status === 'REJECTED' ? 'back' : s.status === 'SKIPPED' ? 'skip' : asked ? 'ask' : current ? 'now' : 'todo',
    });
  }
  out.push({
    key: 'paid',
    label: 'Paid',
    who: c.status === 'PAID' ? (c.paymentDate ? formatDate(c.paymentDate) : 'paid') : c.status === 'APPROVED' ? 'Finance marks it paid' : c.status === 'REJECTED' ? '—' : 'after approval',
    state: c.status === 'PAID' ? 'done' : c.status === 'APPROVED' ? 'now' : 'todo',
  });
  return out;
}

const DOT: Record<StepState, string> = {
  done: 'border-success bg-success-soft text-success',
  now: 'border-info bg-info-soft text-info',
  ask: 'border-warning bg-warning-soft text-warning',
  back: 'border-destructive bg-destructive-soft text-destructive',
  skip: 'border-border bg-surface text-muted-foreground',
  todo: 'border-border bg-surface text-muted-foreground',
};

export function ClaimStepper({ claim, compact }: { claim: Claim; compact?: boolean }) {
  const steps = claimSteps(claim);
  if (!steps.length) return <p className="text-xs text-muted-foreground">Draft — not sent yet</p>;
  return (
    <ol className="flex items-start gap-1 overflow-x-auto" aria-label="Approval steps">
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          {i > 0 && <li aria-hidden className={cn('mt-2.5 h-0.5 min-w-3 flex-1 rounded', steps[i - 1]!.state === 'done' ? 'bg-success' : 'bg-border')} />}
          <li className="flex min-w-0 shrink-0 items-start gap-1.5">
            <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 [&_svg]:size-3', DOT[s.state])}>
              {s.state === 'done' ? <Check /> : s.state === 'back' ? <X /> : s.state === 'skip' ? <Minus /> : s.state === 'ask' ? <MessageCircleQuestion /> : s.state === 'now' ? <Clock /> : <span className="text-[9px] font-bold">{i + 1}</span>}
            </span>
            <span className={cn('min-w-0 leading-tight', compact ? 'max-w-[110px]' : 'max-w-[150px]')}>
              <span className={cn('block truncate text-xs font-semibold', s.state === 'skip' && 'text-muted-foreground line-through')}>{s.label}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{s.who}</span>
            </span>
          </li>
        </React.Fragment>
      ))}
    </ol>
  );
}

export function FlagChips({ flags, clean }: { flags: ClaimFlag[]; clean?: boolean }) {
  if (!flags.length) return clean ? <span className="flex"><Badge tone="success">✓ Clean</Badge></span> : null;
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map((f) => <Badge key={f} tone={FLAG_LABEL[f].tone}>⚑ {FLAG_LABEL[f].label}</Badge>)}
    </span>
  );
}
