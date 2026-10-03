'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, LifeBuoy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { PRIORITY, QUEUE_INFO, STATUS, dueText, type Ticket } from '@/lib/company/helpdesk';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

type PageQuery = { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown; data?: { data: Ticket[]; meta: { total: number; page: number; limit: number; totalPages: number } } };

export function TicketList({ query, agentView, empty, emptyText, page, onPage }: { query: PageQuery; agentView?: boolean; empty: string; emptyText?: string; page: number; onPage: (p: number) => void }) {
  if (query.isLoading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px] w-full" />)}</div>;
  if (query.isError) return <ErrorState message={getApiErrorMessage(query.error, 'Could not load tickets')} onRetry={() => query.refetch()} />;
  if (!query.data?.data.length) return <EmptyState icon={<LifeBuoy />} title={empty} description={emptyText} />;
  return (
    <div className="space-y-2">
      {query.data.data.map((t) => {
        const running = t.status === 'OPEN' || t.status === 'IN_PROGRESS';
        const due = agentView && running ? dueText(!t.firstRespondedAt ? t.firstResponseDueAt : t.resolutionDueAt) : null;
        return (
          <Link key={t.id} href={`/app/helpdesk/${t.id}`} className="block">
            <Card className={cn('flex items-center gap-3 p-4 transition-colors hover:border-foreground/20', (t.responseOverdue || t.resolutionOverdue) && agentView && 'border-destructive/40')}>
              {agentView ? <PersonAvatar person={t.employee} /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground">{QUEUE_INFO[t.queue].label}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  <span className="text-muted-foreground">#{t.number}</span> {t.subject}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {agentView && `${t.employee.firstName} ${t.employee.lastName} · `}
                  {QUEUE_INFO[t.queue].label}
                  {t.category && ` · ${t.category.name}`}
                  {` · updated ${formatRelative(t.lastActivityAt)}`}
                  {agentView && (t.assignee ? ` · ${t.assignee.firstName} ${t.assignee.lastName}` : ' · unassigned')}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <div className="flex items-center gap-1.5">
                  {(agentView || t.priority === 'URGENT' || t.priority === 'HIGH') && <Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Badge>}
                  <Badge tone={STATUS[t.status].tone}>{!agentView && t.status === 'WAITING' ? 'Needs your reply' : STATUS[t.status].label}</Badge>
                </div>
                {due && (
                  <span className={cn('inline-flex items-center gap-1 text-2xs', due.late ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                    <Clock className="h-3 w-3" />
                    {!t.firstRespondedAt ? 'reply ' : 'resolve '}
                    {due.text}
                  </span>
                )}
              </div>
            </Card>
          </Link>
        );
      })}
      <Pagination page={page} totalPages={query.data.meta.totalPages} total={query.data.meta.total} limit={query.data.meta.limit} onPageChange={onPage} />
    </div>
  );
}
