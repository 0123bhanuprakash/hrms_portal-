'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowRight, Ban, Building2, CheckCircle2, FileText, PauseCircle, Plus, ServerCog, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { CompanyAvatar } from '@/components/super-admin/company-avatar';
import { ActivityTimeline } from '@/components/super-admin/activity-timeline';
import { AuditEntryDrawer } from '@/components/super-admin/audit-entry-drawer';
import { useAuditLogs, usePlatformStats } from '@/lib/admin/queries';
import type { AuditLogEntry } from '@/lib/admin/types';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { useAuthStore } from '@/store/useAuthStore';

/** Chart colors read the status tokens so they follow light/dark mode and themes. */
const STATUS_SERIES = [
  { key: 'active', name: 'Active', color: 'hsl(var(--success))', status: 'ACTIVE' },
  { key: 'inactive', name: 'Inactive', color: 'hsl(var(--muted-foreground) / 0.45)', status: 'INACTIVE' },
  { key: 'suspended', name: 'Suspended', color: 'hsl(var(--destructive))', status: 'SUSPENDED' },
] as const;

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
      <PageHeader
        eyebrow={`${greeting()}, ${user?.firstName ?? ''}`}
        title="Platform overview"
        description={
          s
            ? `${s.companies.active} of ${s.companies.total} companies active · ${s.companies.newLast30Days} onboarded in the last 30 days`
            : 'Loading platform metrics…'
        }
        action={
          <>
            <Button variant="secondary" asChild>
              <Link href="/super-admin/audit-logs">
                <FileText /> Audit logs
              </Link>
            </Button>
            <Button asChild>
              <Link href="/super-admin/companies/new">
                <Plus /> Onboard company
              </Link>
            </Button>
          </>
        }
      />

      {stats.isError && (
        <Card>
          <ErrorState message={getApiErrorMessage(stats.error, 'Could not load platform stats')} onRetry={() => stats.refetch()} />
        </Card>
      )}

      {/* KPIs — click through to the filtered company list */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Total companies" value={s?.companies.total} icon={<Building2 />} href="/super-admin/companies" />
        <StatCard title="Active" value={s?.companies.active} icon={<CheckCircle2 />} tone="success" href="/super-admin/companies?status=ACTIVE" />
        <StatCard title="Inactive" value={s?.companies.inactive} icon={<PauseCircle />} tone="neutral" href="/super-admin/companies?status=INACTIVE" />
        <StatCard title="Suspended" value={s?.companies.suspended} icon={<Ban />} tone="danger" href="/super-admin/companies?status=SUSPENDED" />
        <StatCard title="Tenant users" value={s?.users.total} icon={<Users />} tone="info" className="col-span-2 sm:col-span-1" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Company status" description="Distribution across the platform" />
          <div className="px-5 pb-5">
            {!s ? (
              <Skeleton className="mx-auto mt-2 h-40 w-40 rounded-full" />
            ) : s.companies.total === 0 ? (
              <EmptyState icon={<Building2 />} title="No companies yet" className="py-8" />
            ) : (
              <StatusDonut counts={s.companies} />
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Recently onboarded"
            description="Newest companies on the platform"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/super-admin/companies">
                  View all <ArrowRight />
                </Link>
              </Button>
            }
          />
          <div className="divide-y divide-border border-t border-border">
            {!s ? (
              [0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                </div>
              ))
            ) : s.recentCompanies.length === 0 ? (
              <EmptyState icon={<Building2 />} title="No companies yet" description="Onboard your first tenant to get started." className="py-8" />
            ) : (
              s.recentCompanies.map((c) => (
                <Link
                  key={c.id}
                  href={`/super-admin/companies/${c.id}`}
                  className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
                >
                  <CompanyAvatar name={c.name} logoUrl={c.branding?.logoUrl} color={c.branding?.primaryColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.slug} · {c._count.users} user{c._count.users === 1 ? '' : 's'} · {formatRelative(c.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                  <ArrowRight className="h-4 w-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              Live activity
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
            </span>
          }
          description="Latest platform events · refreshes every 30 seconds"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/super-admin/audit-logs">
                All logs <ArrowRight />
              </Link>
            </Button>
          }
        />
        <div className="px-3 pb-3">
          {activity.isLoading ? (
            <div className="space-y-2 px-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div>
          ) : activity.data?.data.length ? (
            <ActivityTimeline entries={activity.data.data} onSelect={setSelected} />
          ) : (
            <EmptyState icon={<ServerCog />} title="No activity yet" description="Actions like onboarding or status changes appear here." className="py-8" />
          )}
        </div>
      </Card>

      <AuditEntryDrawer entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function StatusDonut({ counts }: { counts: { active: number; inactive: number; suspended: number; total: number } }) {
  const data = STATUS_SERIES.map((s) => ({ ...s, value: counts[s.key] })).filter((d) => d.value > 0);

  return (
    <div>
      <div className="relative mx-auto h-44 w-44">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={78} paddingAngle={data.length > 1 ? 2 : 0} cornerRadius={4} strokeWidth={0}>
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--raised))',
                color: 'hsl(var(--foreground))',
                boxShadow: '0 12px 24px -4px rgb(0 0 0 / .12)',
                fontSize: 12,
              }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(v: number, n: string) => [`${v} (${Math.round((v / counts.total) * 100)}%)`, n]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{counts.total}</span>
          <span className="text-2xs text-muted-foreground">companies</span>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5">
        {STATUS_SERIES.map((s) => (
          <li key={s.key}>
            <Link
              href={`/super-admin/companies?status=${s.status}`}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-[13px] transition-colors hover:bg-subtle"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="flex-1 text-muted-foreground">{s.name}</span>
              <span className="font-medium tabular-nums">{counts[s.key]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
