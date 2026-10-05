'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, MessageCircleQuestion, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { ClaimStepper, FlagChips } from '@/components/expenses/claim-ui';
import { CLAIM_STATUS, money, type Claim } from '@/lib/company/expenses';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

export function ClaimList({
  query,
  showEmployee,
  empty,
  page,
  onPage,
  action,
  selected,
  onSelect,
  showFlags,
}: {
  query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown; data?: { data: Claim[]; meta: { total: number; page: number; limit: number; totalPages: number } } };
  showEmployee?: boolean;
  empty: string;
  page: number;
  onPage: (p: number) => void;
  action?: (c: Claim) => React.ReactNode;
  /** Bulk selection (approvals) */
  selected?: Set<string>;
  onSelect?: (id: string, on: boolean) => void;
  showFlags?: boolean;
}) {
  if (query.isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>;
  if (query.isError) return <ErrorState message={getApiErrorMessage(query.error, 'Could not load claims')} onRetry={() => query.refetch()} />;
  if (!query.data?.data.length) return <EmptyState icon={<Receipt />} title={empty} />;
  return (
    <div className="space-y-2.5">
      {query.data.data.map((c) => {
        const amount = c.status === 'DRAFT' || c.status === 'PENDING' ? c.totals.claimedPaise : c.totals.approvedPaise;
        return (
          <Card key={c.id} className={cn('flex items-start gap-3 p-4 transition-colors hover:border-foreground/20', selected?.has(c.id) && 'border-primary/60 bg-primary-soft/20')}>
            {onSelect && (
              <input
                type="checkbox"
                className="mt-1.5 accent-[hsl(var(--primary))]"
                checked={selected?.has(c.id) ?? false}
                disabled={!c.canDecide}
                onChange={(e) => onSelect(c.id, e.target.checked)}
                aria-label={`Select ${c.title}`}
              />
            )}
            <Link href={`/app/expenses/${c.id}`} className="flex min-w-0 flex-1 flex-col gap-2.5">
              <div className="flex items-start gap-3">
                {showEmployee ? <PersonAvatar person={c.employee} /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground"><Receipt className="h-4 w-4" /></span>}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{showEmployee && `${c.employee.firstName} ${c.employee.lastName} · `}{c.title}</span>
                    <Badge tone={CLAIM_STATUS[c.status].tone}>{CLAIM_STATUS[c.status].label}</Badge>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.totals.items} item{c.totals.items === 1 ? '' : 's'}
                    {c.project && ` · ${c.project.name}`}
                    {c.submittedAt ? ` · sent ${formatRelative(c.submittedAt)}` : ` · created ${formatRelative(c.createdAt)}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold tabular-nums">{money(amount)}</p>
                  {c.totals.approvedPaise < c.totals.claimedPaise && c.status !== 'DRAFT' && c.status !== 'PENDING' && <p className="text-[11px] text-muted-foreground">claimed {money(c.totals.claimedPaise)}</p>}
                </div>
              </div>
              {c.status !== 'DRAFT' && c.status !== 'CANCELLED' && <ClaimStepper claim={c} compact />}
              {showFlags && c.status === 'PENDING' && <FlagChips flags={c.flags} clean />}
              {c.questionOpen && (
                <p className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-1.5 text-xs text-warning">
                  <MessageCircleQuestion className="h-3.5 w-3.5 shrink-0" />
                  {showEmployee ? (c.questionByMe ? 'You asked a question — waiting for their answer' : 'A question is open') : 'You have a question to answer — it stays with the approver'}
                </p>
              )}
              {c.status === 'REJECTED' && c.rejectionReason && (
                <p className="flex items-center gap-2 rounded-lg bg-destructive-soft px-3 py-1.5 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Sent back: {c.rejectionReason}</p>
              )}
            </Link>
            {action?.(c)}
          </Card>
        );
      })}
      <Pagination page={page} totalPages={query.data.meta.totalPages} total={query.data.meta.total} limit={query.data.meta.limit} onPageChange={onPage} />
    </div>
  );
}
