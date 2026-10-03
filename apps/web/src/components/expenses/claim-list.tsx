'use client';

import React from 'react';
import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { CLAIM_STATUS, STAGE_LABEL, money, type Claim } from '@/lib/company/expenses';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';

export function ClaimList({
  query,
  showEmployee,
  empty,
  page,
  onPage,
  action,
}: {
  query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown; data?: { data: Claim[]; meta: { total: number; page: number; limit: number; totalPages: number } } };
  showEmployee?: boolean;
  empty: string;
  page: number;
  onPage: (p: number) => void;
  action?: (c: Claim) => React.ReactNode;
}) {
  if (query.isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  if (query.isError) return <ErrorState message={getApiErrorMessage(query.error, 'Could not load claims')} onRetry={() => query.refetch()} />;
  if (!query.data?.data.length) return <EmptyState icon={<Receipt />} title={empty} />;
  return (
    <div className="space-y-2">
      {query.data.data.map((c) => {
        const waiting = c.status === 'PENDING' ? c.steps.filter((s) => s.status === 'PENDING').map((s) => STAGE_LABEL[s.stage]) : [];
        return (
          <Card key={c.id} className="flex items-center gap-3 p-4 transition-colors hover:border-foreground/20">
            <Link href={`/app/expenses/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              {showEmployee ? <PersonAvatar person={c.employee} /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground"><Receipt className="h-4 w-4" /></span>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {showEmployee && <span>{c.employee.firstName} {c.employee.lastName} · </span>}
                  {c.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.totals.items} item{c.totals.items === 1 ? '' : 's'}
                  {c.project && ` · ${c.project.name}`}
                  {c.submittedAt ? ` · submitted ${formatRelative(c.submittedAt)}` : ` · created ${formatRelative(c.createdAt)}`}
                  {waiting.length > 0 && ` · waiting for ${waiting.join(' + ')}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums">{money(c.status === 'DRAFT' ? c.totals.claimedPaise : c.totals.approvedPaise)}</p>
                <Badge tone={CLAIM_STATUS[c.status].tone}>{CLAIM_STATUS[c.status].label}</Badge>
              </div>
            </Link>
            {action?.(c)}
          </Card>
        );
      })}
      <Pagination page={page} totalPages={query.data.meta.totalPages} total={query.data.meta.total} limit={query.data.meta.limit} onPageChange={onPage} />
    </div>
  );
}
