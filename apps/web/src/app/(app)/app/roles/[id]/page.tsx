'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { AccessScope, CatalogPermission } from '@hrms/types';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Crown,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Tooltip } from '@/components/ui/tooltip';
import { useUnsavedGuard } from '@/components/theme/theme-editor';
import {
  SCOPE_LABELS,
  useAccess,
  useAccessCatalog,
  type CatalogFeatureWithFlag,
} from '@/lib/access/use-access';
import {
  useCreateRole,
  useDuplicateRole,
  useRole,
  useUpdateRole,
  type GrantInput,
} from '@/lib/company/user-management';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

type Grants = Record<string, AccessScope | null>;
const SCOPE_ORDER: AccessScope[] = [
  'own',
  'direct_reports',
  'all_reports',
  'department',
  'department_tree',
  'location',
  'company',
];
const idx = (s: AccessScope | null | undefined) => (s ? SCOPE_ORDER.indexOf(s) : -1);

export default function RoleEditorPage() {
  const params = useParams<{ id: string }>();
  const isNew = params.id === 'new';
  const router = useRouter();
  const { can, access, isOwner: actorIsOwner, isLoading: accessLoading } = useAccess();
  const catalog = useAccessCatalog();
  const role = useRole(isNew ? null : params.id);
  const create = useCreateRole();
  const update = useUpdateRole(params.id);
  const duplicate = useDuplicateRole();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [grants, setGrants] = useState<Grants>({});
  const [baseline, setBaseline] = useState<string>('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) {
      setBaseline(JSON.stringify({ name: '', description: '', grants: {} }));
    } else if (role.data) {
      setName(role.data.name);
      setDescription(role.data.description);
      setGrants(role.data.grants);
      setBaseline(
        JSON.stringify({
          name: role.data.name,
          description: role.data.description,
          grants: sortGrants(role.data.grants),
        }),
      );
    }
  }, [isNew, role.data]);

  const canManage = can('role.manage');
  const locked = Boolean(role.data?.isOwner);
  const readOnly = !canManage || locked;
  const dirty =
    !readOnly &&
    baseline !== '' &&
    JSON.stringify({ name, description, grants: sortGrants(grants) }) !== baseline;
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
    // Work out the change first, then update state and notify once
    // (side effects inside a state updater run twice in React dev mode)
    const next = { ...grants };
    const removed: string[] = [];
    if (scope === undefined) {
      // Unticking also unticks permissions that depend on this one
      const drop = (k: string) => {
        if (!(k in next)) return;
        delete next[k];
        removed.push(k);
        for (const [other] of Object.entries(next)) {
          if (permissionIndex.get(other)?.requires?.includes(k)) drop(other);
        }
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
    }
    setGrants(next);
    const extra = removed.filter((k) => k !== key);
    if (extra.length) {
      toast.info(
        `Also removed: ${extra.map((k) => permissionIndex.get(k)?.label ?? k).join(', ')} (they need “${permissionIndex.get(key)?.label}”)`,
      );
    }
  };

  const save = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Give the role a name (at least 2 characters)');
    const body = {
      name: name.trim(),
      description: description.trim(),
      grants: Object.entries(grants).map(([key, scope]) => ({
        key,
        ...(scope ? { scope } : {}),
      })) as GrantInput[],
    };
    try {
      if (isNew) {
        const r = await create.mutateAsync(body);
        toast.success(`“${r.name}” created with ${r.permissionCount} permissions`);
        setBaseline(
          JSON.stringify({
            name: body.name,
            description: body.description,
            grants: sortGrants(grants),
          }),
        );
        router.replace(`/app/roles/${r.id}`);
      } else {
        const r = await update.mutateAsync(body);
        const c = r.changes;
        const parts = [
          c?.added.length && `${c.added.length} added`,
          c?.removed.length && `${c.removed.length} removed`,
          c?.rescoped.length && `${c.rescoped.length} re-scoped`,
        ].filter(Boolean);
        toast.success(
          parts.length
            ? `Saved · ${parts.join(' · ')} — applies to ${r.userCount} user(s) on their next click`
            : 'Saved',
        );
        setGrants(r.grants);
        setBaseline(
          JSON.stringify({
            name: r.name,
            description: r.description,
            grants: sortGrants(r.grants),
          }),
        );
      }
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not save the role'));
    }
  };

  // ── Derived ──
  const modules = useMemo(() => catalog.data ?? [], [catalog.data]);
  const q = search.trim().toLowerCase();
  const matches = (f: CatalogFeatureWithFlag, p: CatalogPermission) =>
    !q ||
    p.label.toLowerCase().includes(q) ||
    p.key.includes(q) ||
    f.label.toLowerCase().includes(q);
  const count = Object.keys(grants).length;
  const sensitiveCount = Object.keys(grants).filter(
    (k) => permissionIndex.get(k)?.sensitive,
  ).length;

  if (!accessLoading && !can('role.view')) {
    return (
      <EmptyState
        icon={<ShieldCheck />}
        title="No access"
        description="You don't have permission to view roles."
      />
    );
  }
  if (role.isError)
    return (
      <ErrorState
        message={getApiErrorMessage(role.error, 'Could not load the role')}
        onRetry={() => role.refetch()}
      />
    );
  const loading = catalog.isLoading || (!isNew && role.isLoading);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/app/roles"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[13px] font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Roles & permissions
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {locked && <Crown className="text-warning h-5 w-5" />}
            {isNew ? 'New role' : (role.data?.name ?? <Skeleton className="h-7 w-48" />)}
          </h1>
          {!isNew && role.data && (
            <p className="text-muted-foreground mt-1 text-sm">
              {role.data.userCount} {role.data.userCount === 1 ? 'user' : 'users'} ·{' '}
              {locked ? 'all permissions' : `${role.data.permissionCount} permissions`}
              {role.data.status !== 'ACTIVE' && ' · inactive'}
            </p>
          )}
        </div>
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

      {locked && (
        <Card className="border-warning/30 bg-warning-soft/40 flex items-start gap-3 p-4">
          <Lock className="text-warning mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-sm">
            <p className="text-foreground font-medium">This role can’t be edited</p>
            <p className="text-muted-foreground">
              Company Admins automatically have every permission of every feature enabled for your
              company — including features added later. To give someone partial admin rights, create
              a new role.
            </p>
          </div>
        </Card>
      )}
      {!locked && !canManage && (
        <Card className="text-muted-foreground flex items-center gap-3 p-4 text-sm">
          <Lock className="h-4 w-4" /> You can view this role. Changing roles needs the “Create &
          edit roles” permission.
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {/* Details */}
          {!locked && (
            <Card className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Role name" htmlFor="role-name" required>
                  <Input
                    id="role-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={readOnly}
                    placeholder="e.g. Payroll Officer"
                    maxLength={60}
                  />
                </Field>
                <Field label="Description" htmlFor="role-desc">
                  <Textarea
                    id="role-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={readOnly}
                    rows={2}
                    maxLength={300}
                    placeholder="What is this role for?"
                  />
                </Field>
              </div>
            </Card>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search permissions"
              className="pl-8"
              aria-label="Search permissions"
            />
          </div>

          {/* Matrix */}
          {loading
            ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-40" />)
            : modules.map((m) => {
                const features = m.features.filter((f) => f.permissions.some((p) => matches(f, p)));
                if (!features.length) return null;
                return (
                  <section key={m.key} className="space-y-3">
                    <h2 className="text-muted-foreground px-1 text-xs font-semibold uppercase tracking-wider">
                      {m.label}
                    </h2>
                    {features.map((f) => (
                      <FeatureCard
                        key={f.key}
                        feature={f}
                        grants={grants}
                        allChecked={locked}
                        readOnly={readOnly}
                        visible={(p) => matches(f, p)}
                        onSet={setGrant}
                        grantable={grantable}
                      />
                    ))}
                  </section>
                );
              })}
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="text-primary h-4 w-4" /> What this role can do
            </h2>
            {locked ? (
              <p className="text-muted-foreground mt-3 text-sm">
                Everything, across every enabled feature.
              </p>
            ) : count === 0 ? (
              <p className="text-muted-foreground mt-3 text-sm">
                Nothing yet — tick permissions on the left.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground mt-1 text-xs">
                  {count} permission{count === 1 ? '' : 's'}
                  {sensitiveCount > 0 && (
                    <>
                      {' '}
                      · <span className="text-warning">{sensitiveCount} sensitive</span>
                    </>
                  )}
                </p>
                <ul className="mt-3 max-h-[55vh] space-y-1.5 overflow-y-auto pr-1 text-sm">
                  {Object.entries(grants)
                    .map(([key, scope]) => ({ key, scope, perm: permissionIndex.get(key) }))
                    .filter((g) => g.perm)
                    .sort((a, b) => a.perm!.module.localeCompare(b.perm!.module))
                    .map(({ key, scope, perm }) => (
                      <li key={key} className="flex items-start gap-2">
                        <Check className="text-success mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="text-foreground/90">
                          {perm!.label}
                          {scope && (
                            <span className="text-muted-foreground">
                              {' '}
                              — {SCOPE_LABELS[scope].label.toLowerCase()}
                            </span>
                          )}
                          {perm!.sensitive && (
                            <AlertTriangle className="text-warning ml-1 inline h-3 w-3" />
                          )}
                        </span>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </Card>
        </aside>
      </div>

      {/* Save bar */}
      {!readOnly && (dirty || isNew) && (
        <div className="border-border bg-surface/95 animate-in slide-in-from-bottom-2 sticky bottom-0 z-30 -mx-4 border-t backdrop-blur sm:-mx-6 lg:-mx-8">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <p className="text-muted-foreground truncate text-sm">
              {error ? (
                <span className="text-destructive">{error}</span>
              ) : isNew ? (
                'New role — not saved yet'
              ) : (
                'You have unsaved changes'
              )}
            </p>
            <div className="flex shrink-0 gap-2">
              {!isNew && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    role.data &&
                    (setName(role.data.name),
                    setDescription(role.data.description),
                    setGrants(role.data.grants),
                    setError(null))
                  }
                >
                  Discard
                </Button>
              )}
              <Button onClick={save} loading={create.isPending || update.isPending}>
                {isNew ? 'Create role' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function sortGrants(g: Grants) {
  return Object.fromEntries(Object.entries(g).sort(([a], [b]) => a.localeCompare(b)));
}

function FeatureCard({
  feature,
  grants,
  allChecked,
  readOnly,
  visible,
  onSet,
  grantable,
}: {
  feature: CatalogFeatureWithFlag;
  grants: Grants;
  allChecked: boolean;
  readOnly: boolean;
  visible: (p: CatalogPermission) => boolean;
  onSet: (key: string, scope: AccessScope | null | undefined) => void;
  grantable: (key: string, scope: AccessScope | null) => boolean;
}) {
  const unavailable = feature.stage === 'coming_soon' || feature.enabled === false;
  const [open, setOpen] = useState(!unavailable);
  const selected = feature.permissions.filter((p) => p.key in grants).length;
  const perms = feature.permissions.filter(visible);

  return (
    <Card className={cn('overflow-hidden', unavailable && 'opacity-60')}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {feature.label}
            {feature.stage === 'coming_soon' && <Badge tone="neutral">Coming soon</Badge>}
            {feature.stage === 'beta' && <Badge tone="info">Beta</Badge>}
            {feature.stage !== 'coming_soon' && feature.enabled === false && (
              <Badge tone="neutral">Not in your plan</Badge>
            )}
          </p>
          <p className="text-muted-foreground truncate text-xs">{feature.description}</p>
        </div>
        {!unavailable && (
          <span className="text-muted-foreground text-xs">
            {allChecked ? 'All' : `${selected}/${feature.permissions.length}`}
          </span>
        )}
        <ChevronDown
          className={cn('text-muted-foreground h-4 w-4 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <ul className="divide-border border-border divide-y border-t">
          {perms.map((p) => {
            const checked = allChecked || p.key in grants;
            const scope = allChecked
              ? p.scopes.length
                ? 'company'
                : null
              : (grants[p.key] ?? null);
            const canGrant = grantable(p.key, p.scopes.length ? (scope ?? p.scopes[0]!) : null);
            const disabled = readOnly || unavailable || (!checked && !canGrant);
            return (
              <li
                key={p.key}
                className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center"
              >
                <label
                  className={cn(
                    'flex min-w-0 flex-1 items-start gap-3',
                    disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) =>
                      onSet(
                        p.key,
                        e.target.checked
                          ? p.scopes.length
                            ? pickDefaultScope(p, grantable)
                            : null
                          : undefined,
                      )
                    }
                  />
                  <span className="min-w-0">
                    <span className="text-foreground flex items-center gap-1.5 text-sm">
                      {p.label}
                      {p.sensitive && (
                        <Tooltip content="Sensitive — grant with care">
                          <AlertTriangle className="text-warning h-3.5 w-3.5" />
                        </Tooltip>
                      )}
                      {!checked && !canGrant && !readOnly && !unavailable && (
                        <Tooltip content="You can't grant a permission you don't have yourself">
                          <Lock className="text-muted-foreground h-3 w-3" />
                        </Tooltip>
                      )}
                    </span>
                    <span className="text-muted-foreground font-mono text-[11px]">{p.key}</span>
                  </span>
                </label>
                {p.scopes.length > 0 && checked && (
                  <select
                    aria-label={`Scope for ${p.label}`}
                    value={scope ?? ''}
                    disabled={readOnly || unavailable}
                    onChange={(e) => onSet(p.key, e.target.value as AccessScope)}
                    title={scope ? SCOPE_LABELS[scope].hint : undefined}
                    className="border-input bg-surface text-foreground focus-visible:ring-ring h-8 rounded-md border px-2 text-xs focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60 sm:w-56"
                  >
                    {p.scopes.map((s) => (
                      <option key={s} value={s} disabled={!grantable(p.key, s)}>
                        {SCOPE_LABELS[s].label}
                      </option>
                    ))}
                  </select>
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
function pickDefaultScope(
  p: CatalogPermission,
  grantable: (key: string, scope: AccessScope | null) => boolean,
): AccessScope {
  return p.scopes.find((s) => grantable(p.key, s)) ?? p.scopes[0]!;
}
