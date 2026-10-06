'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowRightLeft, ChevronRight, Eye, MoonStar, Route, Search, ShieldAlert, ShieldCheck, UserSearch, Users } from 'lucide-react';
import type { AccessScope } from '@hrms/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { Input } from '@/components/ui/field';
import { PersonSelect, SearchSelect } from '@/components/ui/pickers';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { CountUp } from '@/components/motion/motion';
import { MiniLadder, RoleChip } from '@/components/admin/role-look';
import { SCOPE_LABELS, useAccess, useAccessCatalog } from '@/lib/access/use-access';
import { useCompanyUsers, useRoles, type RoleSummary } from '@/lib/company/user-management';
import { usePeoplePicker } from '@/lib/company/org';
import { useExplainUser, useSensitiveCheck, useWhoCanAccess, type GrantSource, type UserExplanation } from '@/lib/company/advanced';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

type Tab = 'user' | 'employee' | 'sensitive';

/** Role sources as coloured chips (same colour as on Users and Roles). */
function Sources({ sources, roles }: { sources: GrantSource[]; roles: RoleSummary[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {sources.map((s, i) =>
        s.kind === 'delegation' ? (
          <span key={`${s.id}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
            <ArrowRightLeft className="h-3 w-3" />
            {s.name}
          </span>
        ) : (
          <RoleChip key={`${s.id}-${i}`} role={roles.find((r) => r.id === s.id) ?? { name: s.name, isOwner: s.kind === 'owner' }}>
            {s.kind === 'role' && s.scope && <span className="font-normal opacity-70">· {SCOPE_LABELS[s.scope].label.toLowerCase()}</span>}
          </RoleChip>
        ),
      )}
    </span>
  );
}

function ExplorerContent() {
  const { can, isLoading } = useAccess();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = raw === 'employee' || raw === 'sensitive' ? raw : 'user';

  if (!isLoading && !can('role.view')) {
    return <EmptyState icon={<ShieldCheck />} title="No access" description="The Access Explorer needs permission to view roles." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Roles & permissions" title="Access explorer" description="See exactly what someone can do and why — or who can reach a particular person’s records." />
      <Tabs<Tab>
        value={tab}
        onChange={(t) => router.replace(t === 'user' ? pathname : `${pathname}?tab=${t}`, { scroll: false })}
        tabs={[
          { id: 'user', label: 'What can someone do?', icon: <UserSearch /> },
          { id: 'employee', label: 'Who can access someone?', icon: <Eye /> },
          { id: 'sensitive', label: 'Sensitive data check', icon: <ShieldAlert /> },
        ]}
      />
      <div key={tab} className="animate-fade-up">
        {tab === 'user' ? <ExplainUserPanel /> : tab === 'employee' ? <WhoCanAccessPanel /> : <SensitivePanel />}
      </div>
    </div>
  );
}

// ─── What can someone do? ───────────────────────────────────

function ExplainUserPanel() {
  const params = useSearchParams();
  const users = useCompanyUsers({ limit: 100 });
  const roles = useRoles();
  const [userId, setUserId] = useState<string>(params.get('user') ?? '');
  const [filter, setFilter] = useState('');
  const [why, setWhy] = useState<string | null>(null);
  const explain = useExplainUser(userId || null);

  useEffect(() => {
    if (!userId && users.data?.data.length) setUserId(users.data.data.find((u) => !u.isAdmin)?.id ?? users.data.data[0]!.id);
  }, [userId, users.data]);
  useEffect(() => setWhy(null), [userId]);

  const q = filter.trim().toLowerCase();
  const d = explain.data;
  const people = (users.data?.data ?? []).map((u) => ({ ...u, sub: u.roles.map((r) => r.name).join(', ') }));
  const all = d?.modules.flatMap((m) => m.features.flatMap((f) => f.permissions.map((p) => ({ ...p, feature: f.label })))) ?? [];
  const picked = all.find((p) => p.key === why);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <PersonSelect className="flex-1" aria-label="Person" value={userId} onChange={setUserId} people={people} placeholder="Choose a person" />
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter: salary, approve…" aria-label="Filter permissions" />
        </div>
      </div>

      {explain.isError ? (
        <ErrorState message={getApiErrorMessage(explain.error, 'Could not explain access')} onRetry={() => explain.refetch()} />
      ) : !d ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="flex flex-col items-center gap-4 p-5 lg:sticky lg:top-20 lg:self-start">
            <ReachRings d={d} />
            <div className="text-center">
              <p className="font-semibold">{d.user.name}</p>
              <p className="text-xs text-muted-foreground">{d.user.email}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1">
              {d.roles.map((r) => <RoleChip key={r.id} role={roles.data?.find((x) => x.id === r.id) ?? r} />)}
              {d.delegations.map((g) => (
                <span key={g.id} className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success"><ArrowRightLeft className="h-3 w-3" />covering {g.fromName.split(' ')[0]}</span>
              ))}
            </div>
            <div className="grid w-full grid-cols-2 gap-2">
              <Stat label="Permissions" value={d.permissionCount} hint={d.sensitiveCount ? `${d.sensitiveCount} sensitive` : 'none sensitive'} warn={d.sensitiveCount > 0} />
              <Stat label="Dormant" value={d.dormant.length} hint="feature switched off" />
            </div>
          </Card>

          <div className="min-w-0 space-y-4">
            {picked && <WhyPath d={d} p={picked} roles={roles.data ?? []} onClose={() => setWhy(null)} />}

            {d.delegations.length > 0 && (
              <Card className="border-success/30 bg-success-soft/30 p-4 text-sm">
                {d.delegations.map((g) => (
                  <p key={g.id} className="flex flex-wrap items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-success" />
                    Covering for <b>{g.fromName}</b> until {formatDate(g.until)}: {g.permissions.map((p) => p.label).join(', ')}
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
                  <div className="flex items-center border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span className="flex-1">{m.label}</span>
                    <span className="hidden normal-case tracking-normal sm:block">reach · from · tap a row for “why”</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {features.flatMap((f) =>
                      f.permissions.map((p) => (
                        <li key={p.key}>
                          <button
                            type="button"
                            onClick={() => setWhy(why === p.key ? null : p.key)}
                            className={cn('grid w-full gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center', why === p.key && 'bg-primary-soft/40')}
                          >
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5 font-medium">
                                {p.label}
                                {p.sensitive && <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-label="Sensitive" />}
                              </span>
                              <span className="text-xs text-muted-foreground">{f.label}</span>
                            </span>
                            <span className="flex items-center gap-2">
                              <MiniLadder scope={p.scope} />
                              {p.reach !== null && (
                                <span className="flex w-16 items-center justify-end gap-1 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                                  <Users className="h-3 w-3" /> {p.reach}
                                </span>
                              )}
                            </span>
                            <Sources sources={p.sources} roles={roles.data ?? []} />
                          </button>
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
                <div className="mt-2 flex flex-wrap gap-1">{d.dormant.map((x) => <span key={x.key} className="rounded-full bg-muted px-2 py-0.5 text-xs">{x.label}</span>)}</div>
              </Card>
            )}
            <p className="text-xs text-muted-foreground">
              Change what someone can do on <Link href="/app/users" className="text-primary hover:underline">Users</Link> (their roles) or{' '}
              <Link href="/app/roles" className="text-primary hover:underline">Roles & permissions</Link> (what a role allows).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Concentric rings: themselves → direct reports → team → department → company. The widest one they reach is lit. */
function ReachRings({ d }: { d: UserExplanation }) {
  const r = d.reach;
  const widest = d.isOwner ? 'company' : r?.widest ?? 'own';
  const level = (s: AccessScope | 'own' | null) => {
    if (!s || s === 'own') return 0;
    if (s === 'direct_reports') return 1;
    if (s === 'all_reports') return 2;
    if (s === 'department' || s === 'department_tree' || s === 'location') return 3;
    return 4;
  };
  const lit = level(widest);
  const rings = [
    { size: 236, label: 'Company', n: r?.company },
    { size: 194, label: 'Department', n: r?.department },
    { size: 152, label: 'Team', n: r?.team },
    { size: 110, label: 'Direct', n: r?.direct },
  ];
  return (
    <div className="relative h-[236px] w-[236px]" aria-label={`Widest reach: ${SCOPE_LABELS[widest === 'own' ? 'own' : widest].label}`}>
      {rings.map((ring, i) => {
        const on = 4 - i <= lit;
        return (
          <div
            key={ring.label}
            className={cn('absolute rounded-full border transition-colors duration-500', on ? 'border-primary/30 bg-primary/[0.09]' : 'border-dashed border-border bg-transparent')}
            style={{ left: (236 - ring.size) / 2, top: (236 - ring.size) / 2, width: ring.size, height: ring.size }}
          >
            <span className={cn('absolute inset-x-0 top-1.5 text-center text-[10px] font-semibold', on ? 'text-primary' : 'text-muted-foreground')}>
              {ring.label}
              {ring.n !== undefined && <> · {ring.n}</>}
            </span>
          </div>
        );
      })}
      <span className="adm-ripple absolute rounded-full border-2 border-primary" style={{ left: 0, top: 0, width: 236, height: 236 }} aria-hidden />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-surface">
        <PersonAvatar person={{ firstName: d.user.name.split(' ')[0] ?? '', lastName: d.user.name.split(' ').slice(1).join(' ') }} size="md" />
      </div>
    </div>
  );
}

function WhyPath({ d, p, roles, onClose }: { d: UserExplanation; p: UserExplanation['modules'][number]['features'][number]['permissions'][number] & { feature: string }; roles: RoleSummary[]; onClose: () => void }) {
  const first = d.user.name.split(' ')[0];
  const steps: React.ReactNode[] = [
    <b key="who">{first}</b>,
    <span key="src" className="flex flex-wrap gap-1">
      {p.sources.length ? <Sources sources={p.sources} roles={roles} /> : <span>a role</span>}
    </span>,
    <span key="perm">can <b>{p.label.toLowerCase()}</b></span>,
    <span key="scope">{p.scope === 'own' ? <>only for <b>themselves</b></> : p.scope ? <>for <b>{SCOPE_LABELS[p.scope].label.toLowerCase()}</b></> : <>as a <b>company setting</b></>}</span>,
    ...(p.reach !== null ? [<span key="reach">→ <b>{p.reach}</b> {p.reach === 1 ? 'person' : 'people'} today</span>] : []),
  ];
  return (
    <Card className="m-rise border-primary/30 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Route className="h-4 w-4 text-primary" /> Why can {first} {p.label.toLowerCase()}?
        <button type="button" onClick={onClose} className="ml-auto text-xs font-normal text-muted-foreground hover:text-foreground">Close</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm adm-step">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span className="rounded-lg bg-primary-soft/60 px-2.5 py-1">{s}</span>
          </React.Fragment>
        ))}
      </div>
      {p.scope && <p className="mt-2 text-xs text-muted-foreground">{SCOPE_LABELS[p.scope].hint}. When several roles give it, the widest reach wins.</p>}
    </Card>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: number; hint?: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <CountUp value={value} className="block text-2xl font-semibold tabular-nums" />
      {hint && <p className={cn('text-xs', warn ? 'text-warning' : 'text-muted-foreground')}>{hint}</p>}
    </div>
  );
}

// ─── Who can access someone? ────────────────────────────────

const GROUPS: Array<{ id: string; label: string; tone: string; line: string }> = [
  { id: 'chain', label: 'Their manager chain', tone: 'border-l-primary', line: 'hsl(var(--primary))' },
  { id: 'place', label: 'Same department or office', tone: 'border-l-info', line: 'hsl(var(--info))' },
  { id: 'company', label: 'Company-wide', tone: 'border-l-warning', line: 'hsl(var(--warning))' },
  { id: 'cover', label: 'Covering for someone', tone: 'border-l-success', line: 'hsl(var(--success))' },
  { id: 'self', label: 'Themselves', tone: 'border-l-border', line: 'hsl(var(--muted-foreground))' },
];
const groupOf = (p: { scope: AccessScope; sources: GrantSource[]; reason: string }) =>
  p.sources.some((s) => s.kind === 'delegation')
    ? 'cover'
    : p.reason === 'This is them'
      ? 'self'
      : p.scope === 'direct_reports' || p.scope === 'all_reports'
        ? 'chain'
        : p.scope === 'company'
          ? 'company'
          : 'place';

function WhoCanAccessPanel() {
  const chart = usePeoplePicker();
  const catalog = useAccessCatalog();
  const roles = useRoles();
  const [employeeId, setEmployeeId] = useState('');
  const [permission, setPermission] = useState('employee.view');
  const who = useWhoCanAccess(employeeId || null, permission);

  useEffect(() => {
    if (!employeeId && chart.data?.employees.length) setEmployeeId(chart.data.employees[0]!.id);
  }, [employeeId, chart.data]);

  const scoped = useMemo(
    () =>
      (catalog.data ?? []).flatMap((m) =>
        m.features.filter((f) => f.enabled !== false && f.stage !== 'coming_soon').flatMap((f) => f.permissions.filter((p) => p.scopes.length).map((p) => ({ value: p.key, label: p.label, sub: `${f.label}${p.sensitive ? ' · sensitive' : ''}`, lead: p.sensitive ? <AlertTriangle className="h-3.5 w-3.5 text-warning" /> : undefined }))),
      ),
    [catalog.data],
  );

  if (chart.data && !chart.data.employees.length) {
    return <EmptyState icon={<Users />} title="No employees yet" description="Add employees to see who can access their records." />;
  }
  const target = chart.data?.employees.find((e) => e.id === employeeId);
  const people = who.data?.people ?? [];
  const grouped = GROUPS.map((g) => ({ ...g, people: people.filter((p) => groupOf(p) === g.id) })).filter((g) => g.people.length);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-2 p-4 text-base font-semibold">
        <span>Who can</span>
        <SearchSelect className="w-full sm:w-64" aria-label="Doing what" value={permission} onChange={setPermission} options={scoped} searchPlaceholder="Search permissions…" />
        <span>for</span>
        <PersonSelect className="w-full sm:w-64" aria-label="Whose records" value={employeeId} onChange={setEmployeeId} people={(chart.data?.employees ?? []).map((e) => ({ ...e, sub: e.designation?.name ?? null }))} />
        <span>?</span>
      </Card>

      {who.isError ? (
        <ErrorState message={getApiErrorMessage(who.error, 'Could not check access')} onRetry={() => who.refetch()} />
      ) : !who.data ? (
        <Skeleton className="h-60" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title={!who.data.featureEnabled ? 'Nobody — this feature is switched off' : `${people.length} ${people.length === 1 ? 'person' : 'people'} can`}
              description={who.data.permission.key.endsWith('.approve') ? 'People never approve their own requests.' : `“${who.data.permission.label}” for ${who.data.employee.name}`}
              icon={who.data.permission.sensitive ? <AlertTriangle className="text-warning" /> : <Eye />}
            />
            {people.length > 0 && target && <Lines groups={grouped} target={target} />}
          </Card>
          <div className="space-y-3 m-stagger">
            {grouped.map((g) => (
              <Card key={g.id} className={cn('overflow-hidden border-l-[3px]', g.tone)}>
                <p className="px-4 pt-3 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</p>
                <ul className="divide-y divide-border">
                  {g.people.map((p) => (
                    <li key={p.userId} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                      <PersonAvatar person={{ firstName: p.name.split(' ')[0] ?? '', lastName: p.name.split(' ').slice(1).join(' ') }} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{p.reason}</span>
                      </span>
                      <Sources sources={p.sources} roles={roles.data ?? []} />
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Each person above, a curved line down to the person whose records they reach. */
function Lines({ groups, target }: { groups: Array<{ id: string; line: string; people: Array<{ userId: string; name: string }> }>; target: { firstName: string; lastName: string } }) {
  const flat = groups.flatMap((g) => g.people.map((p) => ({ ...p, line: g.line }))).slice(0, 8);
  const W = 520;
  const xs = flat.map((_, i) => ((i + 0.5) / flat.length) * W);
  return (
    <div className="relative px-4 pb-4">
      <svg viewBox={`0 0 ${W} 200`} className="h-[200px] w-full" preserveAspectRatio="none" aria-hidden>
        {flat.map((p, i) => (
          <path key={p.userId} className="adm-draw" style={{ ['--len' as string]: '320', animationDelay: `${i * 0.12}s` }} d={`M${xs[i]} 52 C ${xs[i]} 120, ${W / 2} 110, ${W / 2} 168`} fill="none" stroke={p.line} strokeOpacity="0.6" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {flat.map((p, i) => (
        <span key={p.userId} className="absolute top-1 flex w-16 -translate-x-1/2 flex-col items-center gap-0.5 m-pop" style={{ left: `calc(1rem + (100% - 2rem) * ${xs[i]! / W})`, animationDelay: `${i * 0.08}s` }}>
          <PersonAvatar person={{ firstName: p.name.split(' ')[0] ?? '', lastName: p.name.split(' ').slice(1).join(' ') }} size="sm" />
          <span className="w-full truncate text-center text-[10px] font-medium">{p.name.split(' ')[0]}</span>
        </span>
      ))}
      <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-0.5 rounded-xl bg-primary-soft px-2 py-1">
        <PersonAvatar person={target} size="md" />
        <span className="text-[11px] font-semibold">{target.firstName}</span>
      </span>
    </div>
  );
}

// ─── Sensitive data check ───────────────────────────────────

function SensitivePanel() {
  const check = useSensitiveCheck(true);
  const roles = useRoles();
  const [open, setOpen] = useState<string | null>(null);
  if (check.isError) return <ErrorState message={getApiErrorMessage(check.error, 'Could not run the check')} onRetry={() => check.refetch()} />;
  if (!check.data) return <Skeleton className="h-80" />;
  const items = [...check.data].sort((a, b) => b.holders.length - a.holders.length);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Private data and powerful actions — and who can use them on <b className="text-foreground">other people</b>. Everyone can always see their own.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 m-stagger">
        {items.map((it) => {
          const many = it.holders.length > 3;
          const rolesHere = [...new Map(it.holders.flatMap((h) => h.sources).filter((s) => s.kind !== 'delegation' && s.scope !== 'own').map((s) => [s.id, s])).values()];
          return (
            <Card key={it.key} className={cn('flex flex-col gap-3 p-4', many && 'border-warning/40')}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{it.label}</p>
                  <p className="text-xs text-muted-foreground">{it.feature}</p>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', !it.holders.length ? 'bg-muted text-muted-foreground' : many ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary')}>
                  {it.holders.length} {it.holders.length === 1 ? 'person' : 'people'}
                </span>
              </div>
              {it.holders.length ? (
                <>
                  <div className="flex flex-wrap gap-1"><Sources sources={rolesHere} roles={roles.data ?? []} /></div>
                  <button type="button" onClick={() => setOpen(open === it.key ? null : it.key)} className="flex items-center gap-1 text-left text-xs text-muted-foreground hover:text-foreground">
                    <span className="flex">
                      {it.holders.slice(0, 5).map((h) => (
                        <PersonAvatar key={h.userId} person={{ firstName: h.name.split(' ')[0] ?? '', lastName: h.name.split(' ').slice(1).join(' ') }} size="xs" className="-ml-1.5 border-2 border-surface first:ml-0" />
                      ))}
                    </span>
                    {open === it.key ? 'Hide' : 'Show'} people
                  </button>
                  {open === it.key && (
                    <ul className="space-y-1 text-xs m-rise">
                      {it.holders.map((h) => (
                        <li key={h.userId} className="flex items-center justify-between gap-2">
                          <Link className="truncate hover:text-primary hover:underline" href={`/app/access-explorer?user=${h.userId}`}>{h.name}</Link>
                          <span className="text-muted-foreground">{h.scope ? SCOPE_LABELS[h.scope].label : 'company setting'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Nobody — only each person for themselves.</p>
              )}
            </Card>
          );
        })}
      </div>
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
