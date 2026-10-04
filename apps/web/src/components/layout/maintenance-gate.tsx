'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wrench, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, MAINTENANCE_EVENT } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

interface PlatformStatus {
  paused: { title: string; message: string; endsAt: string | null } | null;
  notice: { title: string; message: string; startsAt: string; endsAt: string | null } | null;
}

function usePlatformStatus(fast: boolean) {
  return useQuery({
    queryKey: ['platform-status'],
    queryFn: async () => (await api.get('/platform/status')).data.data as PlatformStatus,
    refetchInterval: fast ? 30_000 : 5 * 60_000,
    staleTime: 20_000,
  });
}

/**
 * Company portal: while the platform is paused for maintenance, shows a calm
 * full-page notice instead of the app (it comes back on its own); before a
 * planned window, a dismissible banner.
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [hit, setHit] = useState(false);
  const status = usePlatformStatus(hit);
  const [hidden, setHidden] = useState<string | null>(null);

  useEffect(() => {
    const on = () => setHit(true);
    window.addEventListener(MAINTENANCE_EVENT, on);
    return () => window.removeEventListener(MAINTENANCE_EVENT, on);
  }, []);

  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem('maintenance-notice-hidden'));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const paused = status.data?.paused;
  useEffect(() => {
    // Back from maintenance: reload so every page refetches cleanly
    if (hit && status.data && !paused) window.location.reload();
  }, [hit, status.data, paused]);

  if (paused) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6 text-foreground">
        <div className="m-pop w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-soft text-warning">
            <Wrench className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-xl font-semibold">{paused.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{paused.message}</p>
          {paused.endsAt && <p className="mt-3 text-xs text-muted-foreground">Expected back by {formatDateTime(paused.endsAt)}</p>}
          <p className="mt-6 text-xs text-muted-foreground">This page checks again every 30 seconds.</p>
          <Button className="mt-4" variant="secondary" size="sm" onClick={() => status.refetch()} loading={status.isFetching}>
            Check now
          </Button>
        </div>
      </div>
    );
  }

  const notice = status.data?.notice;
  const noticeKey = notice ? `${notice.startsAt}|${notice.title}` : null;
  return (
    <>
      {notice && hidden !== noticeKey && (
        <div className="flex items-center gap-2 border-b border-warning/30 bg-warning-soft/60 px-4 py-2 text-sm" role="status">
          <Wrench className="h-4 w-4 shrink-0 text-warning" />
          <span className="min-w-0 flex-1">
            <b>{notice.title}</b> — {notice.message} <span className="text-muted-foreground">({formatDateTime(notice.startsAt)}{notice.endsAt ? ` – ${formatDateTime(notice.endsAt)}` : ''})</span>
          </span>
          <button
            type="button"
            aria-label="Hide notice"
            className="rounded p-1 hover:bg-warning-soft"
            onClick={() => {
              setHidden(noticeKey);
              try {
                sessionStorage.setItem('maintenance-notice-hidden', noticeKey ?? '');
              } catch {
                /* storage unavailable */
              }
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {children}
    </>
  );
}
