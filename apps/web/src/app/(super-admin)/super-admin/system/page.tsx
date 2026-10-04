'use client';

import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, ErrorState } from '@/components/ui/feedback';
import { HealthTab } from '@/components/super-admin/system/health-tab';
import { DataTab } from '@/components/super-admin/system/data-tab';
import { ReadyTab } from '@/components/super-admin/system/ready-tab';
import { useSystemStatus } from '@/lib/admin/queries';
import { useCheckNow, useReadiness } from '@/lib/admin/system';
import { useUiState } from '@/lib/preferences/ui-state';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

type Tab = 'health' | 'data' | 'ready';
const isTab = (v: unknown): v is Tab => v === 'health' || v === 'data' || v === 'ready';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'health', label: 'Health & speed' },
  { key: 'data', label: 'Data & delivery' },
  { key: 'ready', label: 'Readiness & tools' },
];

export default function SystemPage() {
  const { data, isError, error, refetch, isFetching, dataUpdatedAt } = useSystemStatus({ refetchInterval: 15_000 });
  const [tab, setTab] = useUiState<Tab>('sa:system-tab', 'health', isTab);
  const readiness = useReadiness();
  const check = useCheckNow();
  const todo = readiness.data ? readiness.data.total - readiness.data.done : 0;

  // "Send a test email" in Tools opens the Data & delivery tab
  useEffect(() => {
    const open = (e: Event) => {
      const next = (e as CustomEvent<string>).detail;
      if (isTab(next)) setTab(next);
      setTimeout(() => document.getElementById('email-delivery')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    };
    window.addEventListener('system:open-tab', open);
    return () => window.removeEventListener('system:open-tab', open);
  }, [setTab]);

  const checkNow = () =>
    check.mutate(undefined, {
      onSuccess: (r) => {
        toast.success(r.ok ? 'All checks passed' : 'Some checks failed');
        void refetch();
      },
      onError: (e) => toast.error(getApiErrorMessage(e, 'Checks failed')),
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">System</h1>
          <p className="text-sm text-muted-foreground">Health, speed and setup of this deployment — and the tools to look after it.</p>
        </div>
        <div className="flex items-center gap-3">
          {dataUpdatedAt > 0 && <span className="text-xs text-muted-foreground">Updated {formatRelative(new Date(dataUpdatedAt))} · every 15 s</span>}
          <Button variant="secondary" icon={<RefreshCw className={cn('h-4 w-4', (isFetching || check.isPending) && 'animate-spin')} />} onClick={checkNow} disabled={check.isPending}>
            Check now
          </Button>
        </div>
      </div>

      <div role="tablist" className="flex gap-6 border-b border-border text-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn('-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 font-medium transition-colors', tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            {t.label}
            {t.key === 'ready' && todo > 0 && <span className="rounded-full bg-warning-soft px-1.5 text-[11px] font-bold text-warning">{todo}</span>}
          </button>
        ))}
      </div>

      {isError ? (
        <Card>
          <ErrorState message={getApiErrorMessage(error, 'Could not reach the API')} onRetry={() => refetch()} />
        </Card>
      ) : tab === 'health' ? (
        <HealthTab system={data} />
      ) : tab === 'data' ? (
        <DataTab system={data} />
      ) : (
        <ReadyTab system={data} onRefresh={() => void refetch()} />
      )}
    </div>
  );
}
