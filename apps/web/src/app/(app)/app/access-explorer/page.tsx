'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowRightLeft, Crown, Eye, MoonStar, Search, ShieldCheck, UserSearch, Users } from 'lucide-react';
import type { AccessScope } from '@hrms/types';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { inputClass } from '@/components/ui/field';
import { SCOPE_LABELS, useAccess, useAccessCatalog } from '@/lib/access/use-access';
import { useCompanyUsers } from '@/lib/company/user-management';
import { useOrgChart } from '@/lib/company/org';
import { useExplainUser, useWhoCanAccess, type GrantSource } from '@/lib/company/advanced';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

type Tab = 'user' | 'employee';

function ScopePill({ scope }: { scope: AccessScope | null }) {
  if (!scope) return <Badge tone="neutral">Company setting</Badge>;
  return (
    <Badge tone={scope === 'company' ? 'warning' : scope === 'own' ? 'neutral' : 'info'} title={SCOPE_LABELS[scope].hint}>
      {SCOPE_LABELS[scope].label}
    </Badge>
  );
}

function Sources({ sources }: { sources: GrantSource[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {sources.map((s, i) => (
        <Badge key={`${s.id}-${i}`} tone={s.kind === 'owner' ? 'warning' : s.kind === 'delegation' ? 'success' : 'primary'}>
          {s.kind === 'owner' && <Crown className="h-3 w-3" />}
          {s.kind === 'delegation' && <ArrowRightLeft className="h-3 w-3" />}
          {s.name}
          {s.kind === 'role' && s.scope && <span className="opacity-70">· {SCOPE_LABELS[s.scope].label.toLowerCase()}</span>}
        </Badge>
      ))}
    </span>
  );
}

function ExplorerContent() {
  const { can, isLoading } = useAccess();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = params.get('tab') === 'employee' ? 'employee' : 'user';

  if (!isLoading && !can('role.view')) {
    return <EmptyState icon={<ShieldCheck />} title="No access" description="The Access Explorer needs permission to view roles." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Roles & permissions"
        title="Access explorer"
        description="See exactly what someone can do and why — or who can reach a particular person’s records."
      />
      <Tabs<Tab>
        value={tab}
        onChange={(t) => router.replace(t === 'user' ? pathname : `${pathname}?tab=employee`, { scroll: false })}
        tabs={[
          { id: 'user', label: 'What can someone do?', icon: <UserSearch /> },
          { id: 'employee', label: 'Who can access someone?', icon: <Eye /> },
        ]}
      />
      <div key={tab} className="animate-fade-up">{tab === 'user' ? <ExplainUserPanel /> : <WhoCanAccessPanel />}</div>
    </div>
  );
}

// ─── What can someone do? ───────────────────────────────────

function ExplainUserPanel() {
  const params = useSearchParams();
  const users = useCompanyUsers({ limit: 100 });
  const [userId, setUserId] = useState<string>(params.get('user') ?? '');
  const [filter, setFilter] = useState('');
  const explain = useExplainUser(userId || null);

  useEffect(() => {
    if (!userId && users.data?.data.length) setUserId(users.data.data.find((u) => !u.isAdmin)?.id ?? users.data.data[0]!.id);
  }, [userId, users.data]);

  const q = filter.trim().toLowerCase();
  const d = explain.data;

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <label className="flex-1 space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Person</span>
          <select className={inputClass} value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Person">
            {users.data?.data.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} — {u.roles.map((r) => r.name).join(', ')}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 sm:w-64">
          <span className="text-xs font-medium text-muted-foreground">Filter permissions</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input className={cn(inputClass, 'pl-8')} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="e.g. salary, approve" />
          </div>
        </label>
      </Card>

      {explain.isError ? (
        <ErrorState message={getApiErrorMessage(explain.error, 'Could not explain access')} onRetry={() => explain.refetch()} />
      ) : !d ? (
        <Skeleton className="h-80" />
      ) : (
        <>
          <Card className="grid gap-4 p-5 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <p className="text-lg font-semibold">{d.user.name}</p>
              <p className="text-sm text-muted-foreground">{d.user.email}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {d.roles.map((r) => (
                  <Badge key={r.id} tone={d.isOwner && r.key === 'company_admin' ? 'warning' : 'primary'}>{r.name}</Badge>
                ))}
              </div>
            </div>
            <Stat label="Permissions" value={d.permissionCount} hint={d.sensitiveCount ? `${d.sensitiveCount} sensitive` : undefined} />
            <Stat
              label="Their team"
              value={d.employee ? d.employee.allReports : '—'}
              hint={d.employee ? `${d.employee.directReports} direct report${d.employee.directReports === 1 ? '' : 's'}` : 'No employee record'}
            />
          </Card>

          {d.delegations.length > 0 && (
            <Card className="border-success/30 bg-success-soft/30 p-4 text-sm">
              {d.delegations.map((g) => (
                <p key={g.id} className="flex flex-wrap items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-success" />
                  Covering for <b>{g.fromName}</b> until {formatDate(g.until)}:
                  {g.permissions.map((p) => <Badge key={p.key} tone="success">{p.label}{p.scope ? ` · ${SCOPE_LABELS[p.scope].label.toLowerCase()} (theirs)` : ''}</Badge>)}
                </p>
              ))}
            </Card>
          )}

          {d.modules.map((m) => {
            const features = m.features
              .map((f) => ({ ...f, permissions: f.permissions.filter((p) => !q || p.label.toLowerCase().includes(q) || p.key.includes(q)) }))
              .filter((f) => f.permissions.length);
            if (!features.length) return null;
            return (
              <Card key={m.key} className="overflow-hidden">
                <p className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</p>
                <ul className="divide-y divide-border">
                  {features.flatMap((f) =>
                    f.permissions.map((p) => (
                      <li key={p.key} className="grid gap-2 px-4 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 font-medium">
                            {p.label}
                            {p.sensitive && <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-label="Sensitive" />}
                          </span>
                          <span className="text-xs text-muted-foreground">{f.label}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <ScopePill scope={p.scope} />
                          {p.reach !== null && (
                            <span className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                              <Users className="h-3 w-3" /> {p.reach} {p.reach === 1 ? 'person' : 'people'}
                            </span>
                          )}
                        </span>
                        <Sources sources={p.sources} />
                      </li>
                    )),
                  )}
                </ul>
              </Card>
            );
          })}

          {d.dormant.length > 0 && (
            <Card className="p-4 text-sm">
              <p className="flex items-center gap-2 font-medium"><MoonStar className="h-4 w-4 text-muted-foreground" /> Dormant — granted by a role, but the feature is switched off for your company</p>
              <div className="mt-2 flex flex-wrap gap-1">{d.dormant.map((x) => <Badge key={x.key} tone="neutral">{x.label}</Badge>)}</div>
            </Card>
          )}
          <p className="text-xs text-muted-foreground">
            Change what someone can do on <Link href="/app/users" className="text-primary hover:underline">Users</Link> (their roles) or <Link href="/app/roles" className="text-primary hover:underline">Roles & permissions</Link> (what a role allows).
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Who can access someone? ────────────────────────────────

function WhoCanAccessPanel() {
  const chart = useOrgChart();
  const catalog = useAccessCatalog();
  const [employeeId, setEmployeeId] = useState('');
  const [permission, setPermission] = useState('employee.view');
  const who = useWhoCanAccess(employeeId || null, permission);

  useEffect(() => {
    if (!employeeId && chart.data?.employees.length) setEmployeeId(chart.data.employees[0]!.id);
  }, [employeeId, chart.data]);

  const scoped = useMemo(
    () =>
      (catalog.data ?? []).flatMap((m) =>
        m.features.filter((f) => f.enabled !== false && f.stage !== 'coming_soon').flatMap((f) => f.permissions.filter((p) => p.scopes.length).map((p) => ({ ...p, feature: f.label }))),
      ),
    [catalog.data],
  );

  if (chart.data && !chart.data.employees.length) {
    return <EmptyState icon={<Users />} title="No employees yet" description="Add employees to see who can access their records." />;
  }

  return (
    <div className="space-y-4">
      <Card className="grid gap-3 p-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Whose records</span>
          <select className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} aria-label="Employee">
            {chart.data?.employees.map((e) => (
              <option key={e.id} value={e.id}>{e.firstName} {e.lastName}{e.designation ? ` — ${e.designation.name}` : ''}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Doing what</span>
          <select className={inputClass} value={permission} onChange={(e) => setPermission(e.target.value)} aria-label="Permission">
            {scoped.map((p) => (
              <option key={p.key} value={p.key}>{p.label} ({p.feature}){p.sensitive ? ' ⚠' : ''}</option>
            ))}
          </select>
        </label>
      </Card>

      {who.isError ? (
        <ErrorState message={getApiErrorMessage(who.error, 'Could not check access')} onRetry={() => who.refetch()} />
      ) : !who.data ? (
        <Skeleton className="h-60" />
      ) : (
        <Card>
          <CardHeader
            title={`Who can “${who.data.permission.label.toLowerCase()}” for ${who.data.employee.name}`}
            description={
              !who.data.featureEnabled
                ? 'This feature is switched off for your company — nobody can.'
                : `${who.data.people.length} ${who.data.people.length === 1 ? 'person' : 'people'}${who.data.permission.key.endsWith('.approve') ? ' · people never approve their own requests' : ''}`
            }
            icon={who.data.permission.sensitive ? <AlertTriangle className="text-warning" /> : <Eye />}
          />
          {who.data.people.length > 0 && (
            <ul className="divide-y divide-border border-t border-border">
              {who.data.people.map((p) => (
                <li key={p.userId} className="grid gap-2 px-4 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                  <span className="min-w-0">
                    <span className="font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{p.reason}</span>
                  <Sources sources={p.sources} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

export default function AccessExplorerPage() {
  return (
    <Suspense>
      <ExplorerContent />
    </Suspense>
  );
}
