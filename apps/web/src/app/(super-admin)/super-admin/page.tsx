'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, FileText, Plus, ServerCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { StatusBadge } from '@/components/ui/status-badge';
import { CompanyAvatar } from '@/components/super-admin/company-avatar';
import { ActivityTimeline } from '@/components/super-admin/activity-timeline';
import { AuditEntryDrawer } from '@/components/super-admin/audit-entry-drawer';
import { useAuditLogs, useCompanies, usePlatformStats, useSystemStatus } from '@/lib/admin/queries';
import { Donut, Meter } from '@/components/dashboard/widgets';
import { Badge } from '@/components/ui/badge';
import type { AuditLogEntry } from '@/lib/admin/types';
import { getApiErrorMessage } from '@/lib/errors';
import { formatRelative } from '@/lib/format';
import { useAuthStore } from '@/store/useAuthStore';
import { HomeHero } from '@/components/dashboard/home-sections';
import { useMoment } from '@/components/motion/moments';

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
  const companies = useCompanies({ page: 1, limit: 6, sortBy: 'createdAt', sortOrder: 'desc' });
  const system = useSystemStatus({ refetchInterval: 60_000 });

  const s = stats.data;
  const moment = useMoment({ firstName: user?.firstName });

  return (
    <div className="space-y-5">
      {stats.isLoadingError && (
        <Card>
          <ErrorState message={getApiErrorMessage(stats.error, 'Could not load platform stats')} onRetry={() => stats.refetch()} />
        </Card>
      )}

      {/* Hero (sky by time of day) + system status */}
      <div className="m-stagger grid gap-5 lg:grid-cols-12">
        <HomeHero
          moment={moment}
          className="lg:col-span-8"
          title={`${greeting()}, ${user?.firstName ?? ''}`}
          subtitle={s ? `${s.companies.active} of ${s.companies.total} companies active · ${s.companies.newLast30Days} onboarded in the last 30 days.` : 'Loading platform numbers…'}
          stats={[
            { label: 'Companies', value: s?.companies.total, suffix: s ? `· ${s.companies.active} active` : undefined },
            { label: 'Tenant users', value: s?.users.total },
            { label: 'Inactive', value: s?.companies.inactive },
            { label: 'Suspended', value: s?.companies.suspended, tone: s?.companies.suspended ? 'warn' : undefined },
          ]}
          actions={[
            { href: '/super-admin/companies/new', label: 'Onboard company', icon: <Plus />, primary: true },
            { href: '/super-admin/companies', label: 'Companies', icon: <Building2 /> },
            { href: '/super-admin/audit-logs', label: 'Audit logs', icon: <FileText /> },
          ]}
        />
        <div className="min-w-0 lg:col-span-4 [&>*]:h-full">
          <SystemCard data={system.data} loading={system.isLoading} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="m-stagger flex min-w-0 flex-col gap-5 lg:col-span-8 [&>*:last-child]:flex-1">
          <CompaniesCard rows={companies.data?.data} loading={companies.isLoading} />
        <Card>
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
        <div className="m-stagger flex min-w-0 flex-col gap-5 lg:col-span-4 [&>*:last-child]:flex-1">
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
  
        </div>
      </div>

      <AuditEntryDrawer entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function StatusDonut({ counts }: { counts: { active: number; inactive: number; suspended: number; total: number } }) {
  return (
    <Donut
      label="Company status"
      total={counts.total}
      center={<><span className="text-2xl font-bold tabular-nums">{counts.total}</span><span className="text-2xs text-muted-foreground">companies</span></>}
      slices={[
        { label: 'Active', value: counts.active, tone: 'success' },
        { label: 'Inactive', value: counts.inactive, tone: 'neutral' },
        { label: 'Suspended', value: counts.suspended, tone: 'danger' },
      ]}
    />
  );
}

/** Newest companies with plan and seats used against the plan's employee limit. */
function CompaniesCard({ rows, loading }: { rows?: import('@/lib/admin/types').CompanyListItem[]; loading: boolean }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Companies"
        description="Plan and seats used"
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/super-admin/companies">All companies <ArrowRight /></Link>
          </Button>
        }
      />
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-2.5 font-medium">Company</th>
              <th className="px-3 py-2.5 font-medium">Plan</th>
              <th className="px-3 py-2.5 font-medium">Employees · limit</th>
              <th className="px-3 py-2.5 font-medium">Users</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading
              ? [0, 1, 2].map((i) => (
                  <tr key={i}><td colSpan={5} className="px-5 py-3"><Skeleton className="h-8 w-full" /></td></tr>
                ))
              : rows?.map((c) => {
                  const max = c.plan?.limits?.maxEmployees ?? null;
                  const used = c._count.employees;
                  const near = max !== null && used >= max * 0.9;
                  return (
                    <tr key={c.id} className="hover:bg-subtle">
                      <td className="px-5 py-3">
                        <Link href={`/super-admin/companies/${c.id}`} className="flex items-center gap-2.5 font-medium hover:underline">
                          <CompanyAvatar name={c.name} logoUrl={c.branding?.logoUrl} color={c.branding?.primaryColor} size="sm" />
                          <span className="truncate">{c.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">{c.plan ? <Badge tone="primary">{c.plan.name}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="min-w-[160px] px-3 py-3">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="tabular-nums">{used}{max !== null ? ` of ${max}` : ''}</span>
                          {max === null ? <span className="text-muted-foreground">no limit</span> : near && <span className="font-semibold text-warning">near limit</span>}
                        </div>
                        <Meter value={used} max={max ?? Math.max(used, 1) * 10} tone={near ? 'warning' : 'primary'} label={`${c.name} employees`} />
                      </td>
                      <td className="px-3 py-3 tabular-nums">{c._count.users}</td>
                      <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Platform services at a glance — details on the System page. */
function SystemCard({ data, loading }: { data?: import('@/lib/admin/types').SystemStatus; loading: boolean }) {
  const pill = (state: 'ok' | 'error' | 'disabled' | 'unverified' | string, ok = 'Operational') =>
    state === 'ok' ? <Badge tone="success">{ok}</Badge> : state === 'error' ? <Badge tone="danger">Unavailable</Badge> : <Badge>Not configured</Badge>;
  return (
    <Card>
      <CardHeader
        title="System"
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/super-admin/system">Details <ArrowRight /></Link>
          </Button>
        }
      />
      {loading || !data ? (
        <div className="space-y-2 px-5 pb-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
      ) : (
        <ul className="divide-y divide-border px-5 pb-2 text-sm">
          <li className="flex items-center gap-3 py-2.5"><span className="flex-1">PostgreSQL</span>{pill(data.health.services.database)}</li>
          <li className="flex items-center gap-3 py-2.5"><span className="flex-1">Redis (email queue)</span>{pill(data.health.services.redis)}</li>
          <li className="flex items-center gap-3 py-2.5"><span className="flex-1">Search</span>{pill(data.health.services.elasticsearch)}</li>
          <li className="flex items-center gap-3 py-2.5"><span className="flex-1">Email · {data.email.provider}</span>{data.email.state === 'unverified' ? <Badge tone="warning">Not verified</Badge> : pill(data.email.state, 'Connected')}</li>
          <li className="flex items-center gap-3 py-2.5"><span className="flex-1">File storage</span><Badge>{data.storage.driver === 's3' ? 'S3' : 'Local disk'}</Badge></li>
          <li className="flex items-center gap-3 py-2.5"><span className="flex-1">API</span><span className="text-xs text-muted-foreground">v{data.api.version} · {data.api.environment}</span></li>
        </ul>
      )}
    </Card>
  );
}
