'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  ArrowRight,
  Ban,
  Building2,
  CheckCircle2,
  FileText,
  PauseCircle,
  Plus,
  ServerCog,
  Sparkles,
  Users,
} from 'lucide-react';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { StatusBadge } from '@/components/ui/status-badge';
import { CompanyAvatar } from '@/components/super-admin/company-avatar';
import { ActivityTimeline } from '@/components/super-admin/activity-timeline';
import { AuditEntryDrawer } from '@/components/super-admin/audit-entry-drawer';
import { useAuditLogs, usePlatformStats } from '@/lib/admin/queries';
import type { AuditLogEntry } from '@/lib/admin/types';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/cn';

const STATUS_COLORS = { Active: '#10B981', Inactive: '#94A3B8', Suspended: '#EF4444' };

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function SuperAdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const stats = usePlatformStats();
  const activity = useAuditLogs({ limit: 8 }, { refetchInterval: 30_000 });
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const s = stats.data;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-6 sm:p-8 text-white shadow-xl shadow-indigo-600/20">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute right-24 -bottom-16 h-40 w-40 rounded-full bg-violet-400/20 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm text-indigo-100">
              <Sparkles className="h-4 w-4" /> {greeting()}, {user?.firstName}
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">Platform overview</h1>
            <p className="mt-1 text-sm text-indigo-100">
              {s ? `${s.companies.active} of ${s.companies.total} companies active · ${s.companies.newLast30Days} onboarded in the last 30 days` : 'Loading platform metrics…'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/super-admin/companies/new" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow hover:bg-indigo-50">
              <Plus className="h-4 w-4" /> Onboard company
            </Link>
            <Link href="/super-admin/audit-logs" className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/25">
              <FileText className="h-4 w-4" /> Audit logs
            </Link>
          </div>
        </div>
      </div>

      {stats.isError && (
        <Card>
          <ErrorState message={getApiErrorMessage(stats.error, 'Could not load platform stats')} onRetry={() => stats.refetch()} />
        </Card>
      )}

      {/* KPI cards — click to open the filtered company list */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Total companies" value={s?.companies.total} icon={<Building2 />} tone="indigo" href="/super-admin/companies" index={0} />
        <Kpi label="Active" value={s?.companies.active} icon={<CheckCircle2 />} tone="emerald" href="/super-admin/companies?status=ACTIVE" index={1} />
        <Kpi label="Inactive" value={s?.companies.inactive} icon={<PauseCircle />} tone="slate" href="/super-admin/companies?status=INACTIVE" index={2} />
        <Kpi label="Suspended" value={s?.companies.suspended} icon={<Ban />} tone="red" href="/super-admin/companies?status=SUSPENDED" index={3} />
        <Kpi label="Tenant users" value={s?.users.total} icon={<Users />} tone="violet" index={4} className="col-span-2 lg:col-span-1" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Status distribution */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Company status</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Distribution across the platform</p>
          {!s ? (
            <Skeleton className="mx-auto mt-6 h-40 w-40 rounded-full" />
          ) : s.companies.total === 0 ? (
            <EmptyState icon={<Building2 />} title="No companies yet" className="py-8" />
          ) : (
            <StatusDonut active={s.companies.active} inactive={s.companies.inactive} suspended={s.companies.suspended} />
          )}
        </Card>

        {/* Recent companies */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h2 className="text-sm font-semibold">Recently onboarded</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Newest companies on the platform</p>
            </div>
            <Link href="/super-admin/companies" className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {!s
              ? [0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-2.5 w-24" />
                    </div>
                  </div>
                ))
              : s.recentCompanies.length === 0
                ? <EmptyState icon={<Building2 />} title="No companies yet" description="Onboard your first tenant to get started." className="py-8" />
                : s.recentCompanies.map((c) => (
                    <Link key={c.id} href={`/super-admin/companies/${c.id}`} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <CompanyAvatar name={c.name} logoUrl={c.branding?.logoUrl} color={c.branding?.primaryColor} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{c.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {c.slug} · {c._count.users} user{c._count.users === 1 ? '' : 's'} · {formatRelative(c.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={c.status} />
                    </Link>
                  ))}
          </div>
        </Card>
      </div>

      {/* Live activity */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              Live activity
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Latest platform events · refreshes every 30s</p>
          </div>
          <Link href="/super-admin/audit-logs" className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
            All logs <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {activity.isLoading ? (
          <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : activity.data?.data.length ? (
          <ActivityTimeline entries={activity.data.data} onSelect={setSelected} />
        ) : (
          <EmptyState icon={<ServerCog />} title="No activity yet" description="Actions like onboarding or status changes appear here." className="py-8" />
        )}
      </Card>

      <AuditEntryDrawer entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

const TONES = {
  indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
};

function Kpi({
  label,
  value,
  icon,
  tone,
  href,
  index,
  className,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  tone: keyof typeof TONES;
  href?: string;
  index: number;
  className?: string;
}) {
  const body = (
    <Card
      className={cn(
        'h-full p-4 transition-all animate-fade-up',
        href && 'group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:border-indigo-300 dark:group-hover:border-indigo-700',
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl [&>svg]:h-[18px] [&>svg]:w-[18px]', TONES[tone])}>{icon}</span>
        {href && <ArrowRight className="h-4 w-4 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />}
      </div>
      {value === undefined ? <Skeleton className="mt-4 h-7 w-12" /> : <p className="mt-3 text-2xl font-bold tabular-nums">{value}</p>}
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </Card>
  );
  return (
    <div className={cn('group', className)} style={{ animationDelay: `${index * 50}ms` }}>
      {href ? <Link href={href}>{body}</Link> : body}
    </div>
  );
}

function StatusDonut({ active, inactive, suspended }: { active: number; inactive: number; suspended: number }) {
  const data = [
    { name: 'Active', value: active },
    { name: 'Inactive', value: inactive },
    { name: 'Suspended', value: suspended },
  ].filter((d) => d.value > 0);
  const total = active + inactive + suspended;

  return (
    <div>
      <div className="relative mx-auto h-44 w-44">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={data.length > 1 ? 3 : 0} strokeWidth={0}>
              {data.map((d) => (
                <Cell key={d.name} fill={STATUS_COLORS[d.name as keyof typeof STATUS_COLORS]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,.15)', fontSize: 12 }}
              formatter={(v: number, n: string) => [`${v} (${Math.round((v / total) * 100)}%)`, n]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-[11px] text-slate-500">companies</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
        {Object.entries({ Active: active, Inactive: inactive, Suspended: suspended }).map(([name, value]) => (
          <Link key={name} href={`/super-admin/companies?status=${name.toUpperCase()}`} className="flex items-center gap-1.5 hover:underline">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[name as keyof typeof STATUS_COLORS] }} />
            {name} <b className="tabular-nums">{value}</b>
          </Link>
        ))}
      </div>
    </div>
  );
}
