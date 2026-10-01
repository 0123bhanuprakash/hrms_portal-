'use client';

import React from 'react';
import Link from 'next/link';
import { Drawer } from '@/components/ui/modal';
import type { AuditLogEntry } from '@/lib/admin/types';
import { describeUserAgent, formatDateTime, formatRelative, humanizeAction } from '@/lib/format';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-2 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-slate-900 dark:text-slate-100 break-all">{children}</dd>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <pre className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-emerald-300">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/** Full detail of one audit log entry. */
export function AuditEntryDrawer({ entry, onClose }: { entry: AuditLogEntry | null; onClose: () => void }) {
  if (!entry) return null;
  const device = describeUserAgent(entry.userAgent);

  return (
    <Drawer
      open
      onClose={onClose}
      title={humanizeAction(entry.action)}
      description={`${formatDateTime(entry.createdAt)} · ${formatRelative(entry.createdAt)}`}
    >
      <div className="space-y-6">
        <dl>
          <Row label="Action">
            <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs">{entry.action}</code>
          </Row>
          <Row label="Actor">
            {entry.user ? (
              <>
                {entry.user.firstName} {entry.user.lastName}
                <span className="block text-xs text-slate-500">{entry.user.email}</span>
              </>
            ) : (
              'System'
            )}
          </Row>
          <Row label="Company">
            {entry.company ? (
              <Link href={`/super-admin/companies/${entry.company.id}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                {entry.company.name}
              </Link>
            ) : (
              'Platform'
            )}
          </Row>
          <Row label="Resource">
            {entry.resourceType}
            {entry.resourceId && <span className="block font-mono text-xs text-slate-500">{entry.resourceId}</span>}
          </Row>
          <Row label="IP address">{entry.ipAddress ?? '—'}</Row>
          <Row label="Device">
            {device.browser} on {device.os}
          </Row>
          <Row label="Request ID">
            <span className="font-mono text-xs">{entry.requestId ?? '—'}</span>
          </Row>
        </dl>
        <JsonBlock title="Before" value={entry.beforeState} />
        <JsonBlock title="Result" value={entry.afterState} />
      </div>
    </Drawer>
  );
}
