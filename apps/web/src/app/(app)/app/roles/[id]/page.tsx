'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type { AccessScope, CatalogPermission } from '@hrms/types';
import { AlertTriangle, ArrowLeft, ChevronDown, Copy, Crown, Eye, Lock, Search, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, FormError, Input, Textarea } from '@/components/ui/field';
import { Tooltip } from '@/components/ui/tooltip';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { CountUp } from '@/components/motion/motion';
import { useUnsavedGuard } from '@/components/theme/theme-editor';
import { roleStyle, roleText, ScopeLadder, SCOPE_ORDER, SCOPE_SHORT } from '@/components/admin/role-look';
import { SCOPE_LABELS, useAccess, useAccessCatalog, type CatalogFeatureWithFlag } from '@/lib/access/use-access';
import { useCreateRole, useDuplicateRole, useRole, useRoleTemplates, useRoles, useUpdateRole, type GrantInput } from '@/lib/company/user-management';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

type Grants = Record<string, AccessScope | null>;
const idx = (s: AccessScope | null | undefined) => (s ? SCOPE_ORDER.indexOf(s) : -1);

function RoleEditor() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const isNew = params.id === 'new';
  const router = useRouter();
  const { can, access, isOwner: actorIsOwner, isLoading: accessLoading } = useAccess();
  const catalog = useAccessCatalog();
  const role = useRole(isNew ? null : params.id);
  const templates = useRoleTemplates();
  const roleList = useRoles();
  const create = useCreateRole();
  const update = useUpdateRole(params.id);
  const duplicate = useDuplicateRole();
  // "Make a role from these" (compare page): up to 3 source roles
  const fromIds = isNew ? (search.get('from') ?? '').split(',').filter(Boolean).slice(0, 3) : [];
  const src1 = useRole(fromIds[0] ?? null);
  const src2 = useRole(fromIds[1] ?? null);
  const src3 = useRole(fromIds[2] ?? null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [grants, setGrants] = useState<Grants>({});
  const [saved, setSaved] = useState<Grants>({});
  const [baseline, setBaseline] = useState<string>('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const seeded = useRef(false);

  // Load the role, or start a new one (blank, from a template, or from roles being compared)
  useEffect(() => {
    if (!isNew) {
      if (role.data) {
        setName(role.data.name);
        setDescription(role.data.description);
        setGrants(role.data.grants);
        setSaved(role.data.grants);
        setBaseline(JSON.stringify({ name: role.data.name, description: role.data.description, grants: sortGrants(role.data.grants) }));
      }
      return;
    }
    if (seeded.current) return;
    const tpl = search.get('template');
    if (tpl) {
      if (!templates.data || !catalog.data) return;
      const t = templates.data.find((x) => x.key === tpl);
      if (t) {
        // Only features the company has
        const ok = (k: string) => catalog.permissionIndex.has(k) && isEnabled(catalog.data!, k);
        setName(t.name);
        setDescription(t.description);
        setGrants(Object.fromEntries(t.grants.filter((g) => ok(g.key)).map((g) => [g.key, g.scope])));
      }
    } else if (fromIds.length) {
      const srcs = [src1.data, src2.data, src3.data].filter(Boolean);
      if (srcs.length < fromIds.length) return;
      const merged: Grants = {};
      for (const r of srcs) {
        for (const [k, s] of Object.entries(r!.grants)) merged[k] = k in merged ? (idx(s) > idx(merged[k]) ? s : merged[k]!) : s;
      }
      setName(srcs.map((r) => r!.name).join(' + ').slice(0, 60));
      setDescription(`Everything ${srcs.map((r) => r!.name).join(' and ')} can do.`);
      setGrants(merged);
    }
    seeded.current = true;
    setBaseline(JSON.stringify({ name: '', description: '', grants: {} }));
  }, [isNew, role.data, templates.data, catalog.data, src1.data, src2.data, src3.data, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const canManage = can('role.manage');
  const locked = Boolean(role.data?.isOwner);
  const readOnly = !canManage || locked;
  const dirty = !readOnly && baseline !== '' && JSON.stringify({ name, description, grants: sortGrants(grants) }) !== baseline;
  useUnsavedGuard(dirty);
  const { permissionIndex } = catalog;

  /** What the current user may hand out (non-owners can't escalate). */
  const grantable = (key: string, scope: AccessScope | null): boolean => {
    if (!access || actorIsOwner || access.isSuperAdmin) return true;
    if (!(key in access.grants)) return false;
    const mine = access.grants[key];
    return scope === null || mine === null || idx(scope) <= idx(mine);
  };

  // ── Editing with dependency handling ──
  const setGrant = (key: string, scope: AccessScope | null | undefined) => {
    const next = { ...grants };
    const removed: string[] = [];
    if (scope === undefined) {
      const drop = (k: string) => {
        if (!(k in next)) return;
        delete next[k];
        removed.push(k);
        for (const [other] of Object.entries(next)) if (permissionIndex.get(other)?.requires?.includes(k)) drop(other);
      };
      drop(key);
    } else {
      const add = (k: string, s: AccessScope | null, via: boolean) => {
        const perm = permissionIndex.get(k);
        if (!perm) return;
        let eff: AccessScope | null = null;
        if (perm.scopes.length) {
          const cap = s ? idx(s) : SCOPE_ORDER.length - 1;
          eff = via
            ? perm.scopes.includes(s as AccessScope)
              ? (s as AccessScope)
              : ([...perm.scopes].reverse().find((x) => idx(x) <= cap) ?? perm.scopes[0]!)
            : (s ?? perm.scopes[perm.scopes.length - 1]!);
        }
        const current = next[k];
        next[k] = k in next && via ? (idx(current) >= idx(eff) ? current! : eff) : eff;
        for (const r of perm.requires ?? []) add(r, eff, true);
      };
      add(key, scope, false);
      if (!(key in grants) && permissionIndex.get(key)?.sensitive) {
        setFlash(key);
        setTimeout(() => setFlash((f) => (f === key ? null : f)), 900);
      }
    }
    setGrants(next);
    const extra = removed.filter((k) => k !== key);
    if (extra.length) toast.info(`Also removed: ${extra.map((k) => permissionIndex.get(k)?.label ?? k).join(', ')} (they need “${permissionIndex.get(key)?.label}”)`);
  };

  /** "Set all to": every ticked scoped permission in a feature to one scope (where it can). */
  const setAll = (f: CatalogFeatureWithFlag, s: AccessScope) => {
    const next = { ...grants };
    for (const p of f.permissions) {
      if (!(p.key in next) || !p.scopes.length) continue;
      const fit = p.scopes.includes(s) ? s : ([...p.scopes].reverse().find((x) => idx(x) <= idx(s)) ?? p.scopes[0]!);
      if (grantable(p.key, fit)) next[p.key] = fit;
    }
    setGrants(next);
  };

  const save = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Give the role a name (at least 2 characters)');
    const body = {
      name: name.trim(),
      description: description.trim(),
      grants: Object.entries(grants).map(([key, scope]) => ({ key, ...(scope ? { scope } : {}) })) as GrantInput[],
    };
    try {
      if (isNew) {
        const r = await create.mutateAsync(body);
        toast.success(`“${r.name}” created with ${r.permissionCount} permissions`);
        setBaseline(JSON.stringify({ name: body.name, description: body.description, grants: sortGrants(grants) }));
        router.replace(`/app/roles/${r.id}`);
      } else {
        const r = await update.mutateAsync(body);
        const c = r.changes;
        const parts = [c?.added.length && `${c.added.length} added`, c?.removed.length && `${c.removed.length} removed`, c?.rescoped.length && `${c.rescoped.length} re-scoped`].filter(Boolean);
        toast.success(parts.length ? `Saved · ${parts.join(' · ')} — applies to ${r.userCount} user(s) on their next click` : 'Saved');
        setGrants(r.grants);
        setSaved(r.grants);
        setBaseline(JSON.stringify({ name: r.name, description: r.description, grants: sortGrants(r.grants) }));
      }
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not save the role'));
    }
  };

  // ── Derived ──
  const modules = useMemo(() => catalog.data ?? [], [catalog.data]);
  const q = query.trim().toLowerCase();
  const matches = (f: CatalogFeatureWithFlag, p: CatalogPermission) => !q || p.label.toLowerCase().includes(q) || p.key.includes(q) || f.label.toLowerCase().includes(q);
  const count = Object.keys(grants).length;
  const sensitiveCount = Object.keys(grants).filter((k) => permissionIndex.get(k)?.sensitive).length;
  const changes = useMemo(() => diff(isNew ? {} : saved, grants), [saved, grants, isNew]);
  // Links like /app/roles/<id>#time open on that module once it has loaded
  const ready = !catalog.isLoading && (isNew || Boolean(role.data));
  useEffect(() => {
    if (!ready || typeof window === 'undefined' || !window.location.hash) return;
    const t = setTimeout(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    return () => clearTimeout(t);
  }, [ready]);
  const roleLook = { key: role.data?.key ?? null, name: name || 'New role', isOwner: locked };

  if (!accessLoading && !can('role.view')) return <EmptyState icon={<ShieldCheck />} title="No access" description="You don't have permission to view roles." />;
  if (role.isLoadingError) return <ErrorState message={getApiErrorMessage(role.error, 'Could not load the role')} onRetry={() => role.refetch()} />;
  const loading = catalog.isLoading || (!isNew && role.isLoading);
  const holders = role.data?.holders ?? [];

  return (
    <div className="space-y-6" style={roleStyle(roleLook)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href="/app/roles" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Roles & permissions
          </Link>
          <h1 className={cn('mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight', !isNew && roleText)}>
            {locked && <Crown className="h-5 w-5" />}
            {isNew ? name || 'New role' : (role.data?.name ?? <Skeleton className="h-7 w-48" />)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {!isNew && role.data && <>{role.data.userCount} {role.data.userCount === 1 ? 'person' : 'people'} · </>}
            {locked ? 'all permissions' : <><CountUp value={count} /> permissions</>}
            {sensitiveCount > 0 && !locked && <span className="text-warning"> · {sensitiveCount} sensitive</span>}
            {role.data && role.data.status !== 'ACTIVE' && ' · inactive'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isNew && canManage && (templates.data?.length ?? 0) > 0 && (
            <DropdownMenu
              label="Start from a template"
              items={templates.data!.map((t) => ({ label: t.name, hint: t.description, icon: <Wand2 />, onSelect: () => { seeded.current = false; router.replace(`/app/roles/new?template=${t.key}`); } }))}
              trigger={() => <Button variant="secondary"><Wand2 /> Template <ChevronDown className="h-3.5 w-3.5" /></Button>}
            />
          )}
          {!isNew && holders.length > 0 && (
            <DropdownMenu
              label="See exactly what they can do"
              items={holders.map((h) => ({ label: `${h.firstName} ${h.lastName}`, icon: <Eye />, onSelect: () => router.push(`/app/access-explorer?user=${h.id}`) }))}
              trigger={() => <Button variant="secondary"><Eye /> Preview as… <ChevronDown className="h-3.5 w-3.5" /></Button>}
            />
          )}
          {!isNew && canManage && !locked && (
            <Button
              variant="secondary"
              loading={duplicate.isPending}
              onClick={() =>
                duplicate.mutate(
                  { id: params.id },
                  {
                    onSuccess: (r) => {
                      toast.success(`Created “${r.name}”`);
                      router.push(`/app/roles/${r.id}`);
                    },
                    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not duplicate')),
                  },
                )
              }
            >
              <Copy /> Duplicate
            </Button>
          )}
        </div>
      </div>

      {locked && (
        <Card className="adm-shimmer flex items-start gap-3 border-warning/30 bg-warning-soft/40 p-4">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-medium text-foreground">This role can’t be edited</p>
            <p className="text-muted-foreground">Company Admins automatically have every permission of every feature enabled for your company — including features added later. To give someone partial admin rights, create a new role.</p>
          </div>
        </Card>
      )}
      {!locked && !canManage && (
        <Card className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> You can view this role. Changing roles needs the “Create & edit roles” permission.
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)_300px]">
        {/* Module rail */}
        <nav aria-label="Modules" className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          <div className="space-y-0.5 rounded-xl border border-border bg-surface p-2">
            {modules.map((m) => {
              const perms = m.features.filter((f) => f.enabled !== false && f.stage !== 'coming_soon').flatMap((f) => f.permissions);
              if (!perms.length) return null;
              const on = locked ? perms.length : perms.filter((p) => p.key in grants).length;
              return (
                <a key={m.key} href={`#${m.key}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                  <Ring value={on} total={perms.length} />
                  <span className="min-w-0 flex-1 truncate">{m.label}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{on}/{perms.length}</span>
                </a>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 space-y-4">
          {!locked && (
            <Card className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Role name" htmlFor="role-name" required>
                  <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} placeholder="e.g. Payroll Officer" maxLength={60} />
                </Field>
                <Field label="Description" htmlFor="role-desc">
                  <Textarea id="role-desc" value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly} rows={2} maxLength={300} placeholder="What is this role for?" />
                </Field>
              </div>
            </Card>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search permissions" className="pl-8" aria-label="Search permissions" />
          </div>

          {loading
            ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-40" />)
            : modules.map((m) => {
                const features = m.features.filter((f) => f.permissions.some((p) => matches(f, p)));
                if (!features.length) return null;
                return (
                  <section key={m.key} id={m.key} className="scroll-mt-20 space-y-3">
                    <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</h2>
                    {features.map((f) => (
                      <FeatureCard key={f.key} feature={f} grants={grants} allChecked={locked} readOnly={readOnly} visible={(p) => matches(f, p)} onSet={setGrant} onSetAll={(s) => setAll(f, s)} grantable={grantable} flash={flash} />
                    ))}
                  </section>
                );
              })}
        </div>

        {/* Summary */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> In plain words</h2>
            {locked ? (
              <p className="mt-3 text-sm text-muted-foreground">Everything, across every enabled feature, for the whole company.</p>
            ) : count === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nothing yet — tick permissions on the left.</p>
            ) : (
              <PlainWords grants={grants} name={name || 'This role'} label={(k) => permissionIndex.get(k)?.label ?? k} sensitive={(k) => Boolean(permissionIndex.get(k)?.sensitive)} />
            )}
          </Card>
          {!isNew && !readOnly && changes.total > 0 && (
            <Card className="m-rise border-2 border-dashed border-warning/40 p-5">
              <h2 className="text-sm font-semibold">Unsaved changes</h2>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs adm-step">
                {changes.added.map((k) => <li key={`a${k}`} className="flex gap-2"><b className="w-3 text-success">+</b>{permissionIndex.get(k)?.label ?? k}{grants[k] && <span className="text-muted-foreground">· {SCOPE_SHORT[grants[k]!].toLowerCase()}</span>}</li>)}
                {changes.widened.map((k) => <li key={`w${k}`} className="flex gap-2"><b className="w-3 text-info">↑</b>{permissionIndex.get(k)?.label ?? k}<span className="text-muted-foreground">· {SCOPE_SHORT[saved[k]!].toLowerCase()} → {SCOPE_SHORT[grants[k]!].toLowerCase()}</span></li>)}
                {changes.narrowed.map((k) => <li key={`n${k}`} className="flex gap-2"><b className="w-3 text-muted-foreground">↓</b>{permissionIndex.get(k)?.label ?? k}<span className="text-muted-foreground">· {SCOPE_SHORT[saved[k]!].toLowerCase()} → {SCOPE_SHORT[grants[k]!].toLowerCase()}</span></li>)}
                {changes.removed.map((k) => <li key={`r${k}`} className="flex gap-2"><b className="w-3 text-destructive">−</b><span className="line-through text-muted-foreground">{permissionIndex.get(k)?.label ?? k}</span></li>)}
              </ul>
              <p className="mt-3 rounded-md bg-warning-soft px-2.5 py-1.5 text-xs">Applies to <b>{role.data?.userCount ?? 0} {role.data?.userCount === 1 ? 'person' : 'people'}</b> on their next click.</p>
            </Card>
          )}
          {!isNew && roleList.data && <p className="px-1 text-xs text-muted-foreground"><Link className="text-primary hover:underline" href={`/app/roles/compare?ids=${params.id},${roleList.data.find((r) => r.id !== params.id && !r.isOwner)?.id ?? ''}`}>Compare with another role →</Link></p>}
        </aside>
      </div>

      {/* Save bar */}
      {!readOnly && (dirty || isNew) && (
        <div className="sticky bottom-0 z-30 -mx-4 border-t border-border bg-surface/95 backdrop-blur animate-in slide-in-from-bottom-2 sm:-mx-6 lg:-mx-8">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0 flex-1 text-sm text-muted-foreground">
              {error ? <FormError>{error}</FormError> : isNew ? 'New role — not saved yet' : <><b className="text-foreground">{changes.total} change{changes.total === 1 ? '' : 's'}</b> · applies to {role.data?.userCount ?? 0} people</>}
            </div>
            <div className="flex shrink-0 gap-2">
              {!isNew && (
                <Button variant="ghost" onClick={() => role.data && (setName(role.data.name), setDescription(role.data.description), setGrants(role.data.grants), setError(null))}>
                  Discard
                </Button>
              )}
              <Button onClick={save} loading={create.isPending || update.isPending}>{isNew ? 'Create role' : 'Save changes'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RoleEditorPage() {
  return (
    <Suspense>
      <RoleEditor />
    </Suspense>
  );
}

function isEnabled(mods: Array<{ features: CatalogFeatureWithFlag[] }>, key: string) {
  for (const m of mods) for (const f of m.features) if (f.permissions.some((p) => p.key === key)) return f.enabled !== false && f.stage !== 'coming_soon';
  return false;
}

function sortGrants(g: Grants) {
  return Object.fromEntries(Object.entries(g).sort(([a], [b]) => a.localeCompare(b)));
}

function diff(before: Grants, after: Grants) {
  const added = Object.keys(after).filter((k) => !(k in before));
  const removed = Object.keys(before).filter((k) => !(k in after));
  const widened: string[] = [];
  const narrowed: string[] = [];
  for (const k of Object.keys(after)) {
    if (!(k in before) || !after[k] || !before[k] || after[k] === before[k]) continue;
    (idx(after[k]) > idx(before[k]) ? widened : narrowed).push(k);
  }
  return { added, removed, widened, narrowed, total: added.length + removed.length + widened.length + narrowed.length };
}

function Ring({ value, total }: { value: number; total: number }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0 -rotate-90" aria-hidden>
      <circle cx="9" cy="9" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
      <circle cx="9" cy="9" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(value / Math.max(1, total)) * c} ${c}`} className="transition-[stroke-dasharray] duration-500" />
    </svg>
  );
}

/** "A Manager can … for their whole team" — grouped by how far it reaches. */
function PlainWords({ grants, name, label, sensitive }: { grants: Grants; name: string; label: (k: string) => string; sensitive: (k: string) => boolean }) {
  const groups = new Map<string, string[]>();
  for (const [k, s] of Object.entries(grants)) {
    const g = s ? s : 'setting';
    groups.set(g, [...(groups.get(g) ?? []), k]);
  }
  const order = [...[...SCOPE_ORDER].reverse(), 'setting'].filter((g) => groups.has(g));
  const where = (g: string) => (g === 'setting' ? 'Company-wide settings' : g === 'own' ? 'For themselves' : `For ${SCOPE_LABELS[g as AccessScope].label.toLowerCase()}`);
  return (
    <div className="mt-3 space-y-3 text-sm adm-step">
      <p className="text-muted-foreground"><b className="text-foreground">{name}</b> can:</p>
      {order.map((g) => {
        const keys = groups.get(g)!;
        return (
          <div key={g}>
            <p className="text-2xs font-semibold uppercase tracking-wider text-primary">{where(g)}</p>
            <p className="leading-relaxed">
              {keys.slice(0, 5).map((k, i) => (
                <span key={k}>
                  {i > 0 && ', '}
                  {label(k).toLowerCase()}
                  {sensitive(k) && <AlertTriangle className="ml-0.5 inline h-3 w-3 text-warning" />}
                </span>
              ))}
              {keys.length > 5 && <span className="text-muted-foreground"> and {keys.length - 5} more</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function FeatureCard({
  feature,
  grants,
  allChecked,
  readOnly,
  visible,
  onSet,
  onSetAll,
  grantable,
  flash,
}: {
  feature: CatalogFeatureWithFlag;
  grants: Grants;
  allChecked: boolean;
  readOnly: boolean;
  visible: (p: CatalogPermission) => boolean;
  onSet: (key: string, scope: AccessScope | null | undefined) => void;
  onSetAll: (s: AccessScope) => void;
  grantable: (key: string, scope: AccessScope | null) => boolean;
  flash: string | null;
}) {
  const unavailable = feature.stage === 'coming_soon' || feature.enabled === false;
  const [open, setOpen] = useState(!unavailable);
  const selected = feature.permissions.filter((p) => p.key in grants).length;
  const perms = feature.permissions.filter(visible);
  const scoped = feature.permissions.filter((p) => p.scopes.length && p.key in grants);
  const shared = [...new Set(feature.permissions.flatMap((p) => p.scopes))].sort((a, b) => idx(a) - idx(b));

  return (
    <Card className={cn('overflow-hidden', unavailable && 'opacity-60')}>
      <div className="flex w-full items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold">
              {feature.label}
              {feature.stage === 'coming_soon' && <Badge tone="neutral">Coming soon</Badge>}
              {feature.stage === 'beta' && <Badge tone="info">Beta</Badge>}
              {feature.stage !== 'coming_soon' && feature.enabled === false && <Badge tone="neutral">Not in your plan</Badge>}
            </p>
            <p className="truncate text-xs text-muted-foreground">{feature.description}</p>
          </div>
          {!unavailable && <span className="text-xs tabular-nums text-muted-foreground">{allChecked ? 'All' : `${selected}/${feature.permissions.length}`}</span>}
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        {!readOnly && !unavailable && scoped.length > 1 && (
          <DropdownMenu
            label="Set all ticked to"
            items={shared.map((s) => ({ label: SCOPE_LABELS[s].label, hint: SCOPE_LABELS[s].hint, onSelect: () => onSetAll(s) }))}
            trigger={() => <Button size="sm" variant="ghost" className="h-7 text-xs">Set all <ChevronDown className="h-3 w-3" /></Button>}
          />
        )}
      </div>
      {open && (
        <ul className="divide-y divide-border border-t border-border">
          {perms.map((p) => {
            const checked = allChecked || p.key in grants;
            const scope = allChecked ? (p.scopes.length ? 'company' : null) : (grants[p.key] ?? null);
            const canGrant = grantable(p.key, p.scopes.length ? (scope ?? p.scopes[0]!) : null);
            const disabled = readOnly || unavailable || (!checked && !canGrant);
            return (
              <li key={p.key} className={cn('flex flex-col gap-2 px-4 py-2.5 transition-colors sm:flex-row sm:items-center', flash === p.key && 'adm-warn bg-warning-soft/40', checked && !allChecked && 'bg-primary-soft/20')}>
                <label className={cn('flex min-w-0 flex-1 items-start gap-3', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onSet(p.key, e.target.checked ? (p.scopes.length ? pickDefaultScope(p, grantable) : null) : undefined)}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm text-foreground">
                      {p.label}
                      {p.sensitive && (
                        <Tooltip content="Sensitive — grant with care">
                          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        </Tooltip>
                      )}
                      {!checked && !canGrant && !readOnly && !unavailable && (
                        <Tooltip content="You can't grant a permission you don't have yourself">
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        </Tooltip>
                      )}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">{p.key}</span>
                  </span>
                </label>
                {p.scopes.length > 0 && checked && (
                  <ScopeLadder label={p.label} scopes={p.scopes} value={scope} disabled={readOnly || unavailable} allowed={(s) => grantable(p.key, s)} onChange={(s) => onSet(p.key, s)} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Least privilege: ticking a scoped permission starts at its narrowest scope; widen it on purpose. */
function pickDefaultScope(p: CatalogPermission, grantable: (key: string, scope: AccessScope | null) => boolean): AccessScope {
  return p.scopes.find((s) => grantable(p.key, s)) ?? p.scopes[0]!;
}
