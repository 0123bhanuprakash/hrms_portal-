'use client';

import React from 'react';
import {
  Building2,
  KeyRound,
  Palette,
  Power,
  ShieldCheck,
  UserCog,
  UserPlus,
  Mail,
  Activity,
} from 'lucide-react';
import type { AuditLogEntry } from '@/lib/admin/types';
import { formatRelative, humanizeAction } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Icon + color per action family. */
function actionStyle(action: string): { icon: React.ReactNode; tone: string } {
  if (action.includes('status')) return { icon: <Power />, tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' };
  if (action.includes('admin:add')) return { icon: <UserPlus />, tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
  if (action.includes('invite')) return { icon: <Mail />, tone: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' };
  if (action.includes('password') || action.includes('session')) return { icon: <KeyRound />, tone: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' };
  if (action.includes('branding')) return { icon: <Palette />, tone: 'bg-pink-500/15 text-pink-600 dark:text-pink-400' };
  if (action.includes('admin')) return { icon: <UserCog />, tone: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' };
  if (action.startsWith('company')) return { icon: <Building2 />, tone: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' };
  if (action.startsWith('auth')) return { icon: <ShieldCheck />, tone: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' };
  return { icon: <Activity />, tone: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' };
}

/** One-line summary of what the entry's result says, when we know the shape. */
function detail(entry: AuditLogEntry): string | null {
  let after = (entry.afterState ?? {}) as Record<string, unknown>;
  // Entries written before the audit fix stored the { data, meta } response envelope
  if (after['data'] && typeof after['data'] === 'object' && 'meta' in after) {
    after = after['data'] as Record<string, unknown>;
  }
  if (entry.action === 'company:status:update' && after['status']) {
    return `${after['previousStatus'] ?? '?'} → ${after['status']}` + (after['statusReason'] ? ` · “${after['statusReason']}”` : '');
  }
  if (typeof after['email'] === 'string' && entry.resourceType === 'user') return after['email'];
  return null;
}

export function ActivityTimeline({
  entries,
  showCompany = true,
  onSelect,
}: {
  entries: AuditLogEntry[];
  showCompany?: boolean;
  onSelect?: (entry: AuditLogEntry) => void;
}) {
  return (
    <ol className="relative space-y-1">
      {entries.map((entry, i) => {
        const { icon, tone } = actionStyle(entry.action);
        const extra = detail(entry);
        return (
          <li key={entry.id} className="relative animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
            {i < entries.length - 1 && (
              <span className="absolute left-[17px] top-10 bottom-[-4px] w-px bg-slate-200 dark:bg-slate-800" aria-hidden />
            )}
            <button
              type="button"
              onClick={() => onSelect?.(entry)}
              className="flex w-full items-start gap-3 rounded-xl p-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full [&>svg]:h-4 [&>svg]:w-4', tone)}>
                {icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900 dark:text-white">
                  {humanizeAction(entry.action)}
                  {showCompany && entry.company && (
                    <span className="font-normal text-slate-500 dark:text-slate-400"> · {entry.company.name}</span>
                  )}
                </span>
                {extra && <span className="block truncate text-xs text-slate-600 dark:text-slate-300">{extra}</span>}
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : 'System'} · {formatRelative(entry.createdAt)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
