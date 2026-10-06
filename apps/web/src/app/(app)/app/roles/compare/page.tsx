'use client';

import React, { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Check, Copy, Crown, ShieldCheck } from 'lucide-react';
import type { AccessScope } from '@hrms/types';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, Skeleton } from '@/components/ui/feedback';
import { RoleChip, roleStyle, roleText, SCOPE_ORDER } from '@/components/admin/role-look';
import { SCOPE_LABELS, useAccess, useAccessCatalog } from '@/lib/access/use-access';
import { useRole, type RoleDetail } from '@/lib/company/user-management';
import { cn } from '@/lib/cn';

type Cell = { has: boolean; scope: AccessScope | null };

function CompareContent() {
  const params = useSearchParams();
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean).slice(0, 3);
  const { can, isLoading } = useAccess();
  const catalog = useAccessCatalog();
  const a = useRole(ids[0] ?? null);
  const b = useRole(ids[1] ?? null);
  const c = useRole(ids[2] ?? null);
  const [onlyDiff, setOnlyDiff] = useState(true);
  const roles = [a.data, b.data, c.data].filter(Boolean) as RoleDetail[];
  const loading = catalog.isLoading || [a, b, c].slice(0, ids.length).some((q) => q.isLoading);

  const cell = (r: RoleDetail, key: string, scopes: AccessScope[]): Cell =>
    r.isOwner ? { has: true, scope: scopes.length ? 'company' : null } : { has: key in r.grants, scope: r.grants[key] ?? null };

  const groups = useMemo(() => {
    const out: Array<{ module: string; rows: Array<{ key: string; label: string; sensitive: boolean; cells: Cell[]; same: boolean }> }> = [];
    for (const m of catalog.data ?? []) {
      const rows = [];
      for (const f of m.features) {
        if (f.enabled === false || f.stage === 'coming_soon') continue;
        for (const p of f.permissions) {
          const cells = roles.map((r) => cell(r, p.key, p.scopes));
          if (!cells.some((x) => x.has)) continue;
          const same = cells.every((x) => x.has === cells[0]!.has && x.scope === cells[0]!.scope);
          rows.push({ key: p.key, label: p.label, sensitive: Boolean(p.sensitive), cells, same });
        }
      }
      if (rows.length) out.push({ module: m.label, rows });
    }
    return out;
  }, [catalog.data, roles]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isLoading && !can('role.view')) return <EmptyState icon={<ShieldCheck />} title="No access" description="You don't have permission to view roles." />;
  if (ids.length < 2) return <EmptyState icon={<ShieldCheck />} title="Pick 2–3 roles" description="Tick roles on Roles & permissions, then press Compare." action={<Button asChild><Link href="/app/roles">Back to roles</Link></Button>} />;

  const all = groups.flatMap((g) => g.rows);
  const same = all.filter((r) => r.same && r.cells.every((x) => x.has)).length;
  const only = roles.map((_, i) => all.filter((r) => r.cells[i]!.has && r.cells.every((x, j) => j === i || !x.has)).length);
  // Union of the roles, widest scope wins → a new role
  const union = new Map<string, AccessScope | null>();
  for (const r of roles) {
    if (r.isOwner) continue;
    for (const [k, s] of Object.entries(r.grants)) {
      const cur = union.get(k);
      union.set(k, !union.has(k) ? s : s && cur ? (SCOPE_ORDER.indexOf(s) > SCOPE_ORDER.indexOf(cur) ? s : cur) : (s ?? cur ?? null));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <Link href="/app/roles" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Roles & permissions
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Compare roles</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">{roles.map((r) => <RoleChip key={r.id} role={r} />)}</div>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5 text-xs font-medium" role="group" aria-label="Rows">
          {[[true, 'Only differences'], [false, 'Everything']].map(([v, l]) => (
            <button key={String(v)} type="button" aria-pressed={onlyDiff === v} onClick={() => setOnlyDiff(v as boolean)} className={cn('rounded-md px-2.5 py-1', onlyDiff === v ? 'bg-surface shadow-sm' : 'text-muted-foreground')}>
              {l as string}
            </button>
          ))}
        </div>
        {can('role.manage') && union.size > 0 && (
          <Button variant="secondary" asChild>
            <Link href={`/app/roles/new?from=${ids.join(',')}`}><Copy /> Make a role from {roles.length === 2 ? 'both' : 'all'}</Link>
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="flex flex-wrap gap-3 text-sm m-stagger">
            <span className="rounded-lg bg-muted px-3 py-1.5">Same in all: <b>{same}</b></span>
            {roles.map((r, i) => (
              <span key={r.id} style={roleStyle(r)} className="rounded-lg bg-muted px-3 py-1.5">
                Only <b className={roleText}>{r.name}</b>: <b>{r.isOwner ? 'everything else' : only[i]}</b>
              </span>
            ))}
          </div>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Permission</th>
                  {roles.map((r) => (
                    <th key={r.id} style={roleStyle(r)} className={cn('px-4 py-3 font-semibold normal-case', roleText)}>
                      {r.isOwner && <Crown className="mr-1 inline h-3.5 w-3.5" />}
                      {r.name} <span className="font-normal text-muted-foreground">· {r.userCount}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const rows = onlyDiff ? g.rows.filter((r) => !r.same) : g.rows;
                  if (!rows.length) return null;
                  return (
                    <React.Fragment key={g.module}>
                      <tr><td colSpan={roles.length + 1} className="bg-muted/40 px-4 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{g.module}</td></tr>
                      {rows.map((row) => (
                        <tr key={row.key} className={cn('border-t border-border', !row.same && 'bg-warning-soft/25')}>
                          <td className="px-4 py-2">
                            <span className="flex items-center gap-1.5 font-medium">{row.label}{row.sensitive && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}</span>
                          </td>
                          {row.cells.map((x, i) => (
                            <td key={roles[i]!.id} style={roleStyle(roles[i]!)} className="px-4 py-2">
                              {!x.has ? (
                                <span className="text-muted-foreground">—</span>
                              ) : x.scope ? (
                                <span className={cn('rounded-full bg-[hsl(var(--rh)_var(--rs)_50%/0.12)] px-2 py-0.5 text-xs font-semibold', roleText)}>{SCOPE_LABELS[x.scope].label}</span>
                              ) : (
                                <Check className={cn('h-4 w-4', roleText)} />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {onlyDiff && all.every((r) => r.same) && <p className="p-6 text-center text-sm text-muted-foreground">These roles allow exactly the same things.</p>}
          </Card>
        </>
      )}
    </div>
  );
}

export default function CompareRolesPage() {
  return (
    <Suspense>
      <CompareContent />
    </Suspense>
  );
}
