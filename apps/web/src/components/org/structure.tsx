'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Briefcase, Building2, Layers, MapPin, Pencil, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { ColorInput, Field, Input, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  useCreateLevel,
  useDeleteDepartment,
  useDeleteDesignation,
  useDeleteLevel,
  useDeleteLocation,
  useDepartments,
  useDesignations,
  useLocations,
  useOrgChart,
  useOrgLevels,
  useReorderLevels,
  useSaveDepartment,
  useSaveDesignation,
  useSaveLocation,
  useSuggestedLevels,
  useUpdateLevel,
  type Department,
  type Designation,
  type OfficeLocation,
  type OrgLevel,
} from '@/lib/company/org';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

const fail = (fallback: string) => (e: unknown) => toast.error(getApiErrorMessage(e, fallback));

function IconButton({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={onClick} className={danger ? 'hover:text-destructive' : undefined}>
      {children}
    </Button>
  );
}

// ─── Departments ────────────────────────────────────────────

export function DepartmentsPanel({ canManage }: { canManage: boolean }) {
  const depts = useDepartments();
  const chart = useOrgChart();
  const remove = useDeleteDepartment();
  const [editing, setEditing] = useState<Partial<Department> | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);

  const people = new Map((chart.data?.employees ?? []).map((e) => [e.id, `${e.firstName} ${e.lastName}`]));
  const tree = useMemo(() => {
    const list = depts.data ?? [];
    const kids = new Map<string | null, Department[]>();
    for (const d of list) {
      const parent = d.parentDepartmentId && list.some((x) => x.id === d.parentDepartmentId) ? d.parentDepartmentId : null;
      kids.set(parent, [...(kids.get(parent) ?? []), d]);
    }
    return kids;
  }, [depts.data]);

  if (depts.isError) return <ErrorState message={getApiErrorMessage(depts.error, 'Could not load departments')} onRetry={() => depts.refetch()} />;

  const render = (parent: string | null, depth: number): React.ReactNode =>
    (tree.get(parent) ?? []).map((d) => (
      <React.Fragment key={d.id}>
        <li className="flex items-center gap-3 px-4 py-2.5" style={{ paddingLeft: 16 + depth * 24 }}>
          <Building2 className={cn('h-4 w-4 shrink-0', depth ? 'text-muted-foreground' : 'text-primary')} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              {d.name} <Badge tone="outline" className="font-mono">{d.code}</Badge>
            </p>
            <p className="text-xs text-muted-foreground">
              {d._count?.employees ?? 0} employee{d._count?.employees === 1 ? '' : 's'}
              {d.headEmployeeId && people.get(d.headEmployeeId) ? ` · Head: ${people.get(d.headEmployeeId)}` : ''}
            </p>
          </div>
          {canManage && (
            <>
              <IconButton label={`Add a sub-department to ${d.name}`} onClick={() => setEditing({ parentDepartmentId: d.id })}><Plus /></IconButton>
              <IconButton label={`Edit ${d.name}`} onClick={() => setEditing(d)}><Pencil /></IconButton>
              <IconButton label={`Delete ${d.name}`} onClick={() => setDeleting(d)} danger><Trash2 /></IconButton>
            </>
          )}
        </li>
        {render(d.id, depth + 1)}
      </React.Fragment>
    ));

  return (
    <Card>
      <CardHeader
        title="Departments"
        description="Nest departments to mirror your organisation. A department scope covers the whole branch when roles use “Department + sub-departments”."
        icon={<Building2 />}
        action={canManage && <Button size="sm" onClick={() => setEditing({})}><Plus /> Department</Button>}
      />
      {depts.isLoading ? (
        <div className="space-y-2 p-4">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : !depts.data?.length ? (
        <EmptyState icon={<Building2 />} title="No departments yet" description="Create departments like Engineering, Sales or HR." />
      ) : (
        <ul className="divide-y divide-border border-t border-border">{render(null, 0)}</ul>
      )}
      <DepartmentDialog value={editing} departments={depts.data ?? []} people={chart.data?.employees ?? []} onClose={() => setEditing(null)} />
      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        isDanger
        isLoading={remove.isPending}
        title={`Delete ${deleting?.name}?`}
        description="Only empty departments can be deleted. Sub-departments move up a level."
        confirmText="Delete"
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(`${deleting.name} deleted`);
              setDeleting(null);
            },
            onError: fail('Could not delete the department'),
          });
        }}
      />
    </Card>
  );
}

function DepartmentDialog({
  value,
  departments,
  people,
  onClose,
}: {
  value: Partial<Department> | null;
  departments: Department[];
  people: Array<{ id: string; firstName: string; lastName: string }>;
  onClose: () => void;
}) {
  const save = useSaveDepartment();
  const [form, setForm] = useState({ name: '', code: '', parentDepartmentId: '', headEmployeeId: '' });
  useEffect(() => {
    if (value) setForm({ name: value.name ?? '', code: value.code ?? '', parentDepartmentId: value.parentDepartmentId ?? '', headEmployeeId: value.headEmployeeId ?? '' });
  }, [value]);
  if (!value) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        id: value.id,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        parentDepartmentId: form.parentDepartmentId || null,
        headEmployeeId: form.headEmployeeId || null,
      },
      {
        onSuccess: () => {
          toast.success(value.id ? 'Department updated' : 'Department created');
          onClose();
        },
        onError: fail('Could not save the department'),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      icon={<Building2 />}
      title={value.id ? `Edit ${value.name}` : 'New department'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="dept-form" loading={save.isPending}>Save</Button>
        </>
      }
    >
      <form id="dept-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <Field label="Name" htmlFor="d-name" required>
            <Input id="d-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus placeholder="Engineering" />
          </Field>
          <Field label="Code" htmlFor="d-code" required>
            <Input id="d-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} required maxLength={12} className="font-mono" placeholder="ENG" />
          </Field>
        </div>
        <Field label="Parent department" htmlFor="d-parent" hint="Leave empty for a top-level department.">
          <select id="d-parent" className={inputClass} value={form.parentDepartmentId} onChange={(e) => setForm({ ...form, parentDepartmentId: e.target.value })}>
            <option value="">— None (top level)</option>
            {departments.filter((d) => d.id !== value.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Department head" htmlFor="d-head">
          <select id="d-head" className={inputClass} value={form.headEmployeeId} onChange={(e) => setForm({ ...form, headEmployeeId: e.target.value })}>
            <option value="">— Not set</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
          </select>
        </Field>
      </form>
    </Modal>
  );
}

// ─── Levels & titles ────────────────────────────────────────

export function LevelsPanel({ canManage }: { canManage: boolean }) {
  const levels = useOrgLevels();
  const designations = useDesignations();
  const suggested = useSuggestedLevels();
  const reorder = useReorderLevels();
  const removeLevel = useDeleteLevel();
  const removeTitle = useDeleteDesignation();
  const [level, setLevel] = useState<Partial<OrgLevel> | null>(null);
  const [title, setTitle] = useState<Partial<Designation> | null>(null);

  if (levels.isError) return <ErrorState message={getApiErrorMessage(levels.error, 'Could not load levels')} onRetry={() => levels.refetch()} />;
  const list = levels.data ?? [];

  const move = (i: number, dir: -1 | 1) => {
    const ids = list.map((l) => l.id);
    [ids[i], ids[i + dir]] = [ids[i + dir]!, ids[i]!];
    reorder.mutate(ids, { onError: fail('Could not reorder') });
  };

  const titlesFor = (levelId: string | null) => (designations.data ?? []).filter((d) => (d.orgLevelId ?? null) === levelId);
  const groups: Array<{ level: OrgLevel | null; titles: Designation[] }> = [
    ...list.map((l) => ({ level: l, titles: titlesFor(l.id) })),
    { level: null, titles: titlesFor(null) },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader
          title="Org levels"
          description="Your company’s ranks, most senior first. People’s levels come from their job title."
          icon={<Layers />}
          action={canManage && list.length > 0 && <Button size="sm" onClick={() => setLevel({})}><Plus /> Level</Button>}
        />
        {levels.isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : !list.length ? (
          <EmptyState
            icon={<Layers />}
            title="No levels yet"
            description="Start with a suggested set and adjust it, or add your own."
            action={
              canManage && (
                <div className="flex gap-2">
                  <Button onClick={() => suggested.mutate(undefined, { onSuccess: () => toast.success('Suggested levels added'), onError: fail('Could not add levels') })} loading={suggested.isPending}>
                    <Sparkles /> Use suggested levels
                  </Button>
                  <Button variant="secondary" onClick={() => setLevel({})}><Plus /> Add my own</Button>
                </div>
              )
            }
          />
        ) : (
          <ol className="divide-y divide-border border-t border-border">
            {list.map((l, i) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-5 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="h-3 w-3 shrink-0 rounded-full border border-border" style={{ background: l.color ?? 'transparent' }} />
                <span className="flex-1 text-sm font-medium">{l.name}</span>
                <span className="text-xs text-muted-foreground">{l.designationCount ?? 0} titles</span>
                {canManage && (
                  <>
                    <IconButton label={`Move ${l.name} up`} onClick={() => i > 0 && move(i, -1)}><ArrowUp className={cn(i === 0 && 'opacity-30')} /></IconButton>
                    <IconButton label={`Move ${l.name} down`} onClick={() => i < list.length - 1 && move(i, 1)}><ArrowDown className={cn(i === list.length - 1 && 'opacity-30')} /></IconButton>
                    <IconButton label={`Edit ${l.name}`} onClick={() => setLevel(l)}><Pencil /></IconButton>
                    <IconButton
                      label={`Delete ${l.name}`}
                      danger
                      onClick={() => removeLevel.mutate(l.id, { onSuccess: () => toast.success(`${l.name} deleted — its titles keep their names`), onError: fail('Could not delete') })}
                    >
                      <Trash2 />
                    </IconButton>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Job titles"
          description="Titles (designations) sit at a level — e.g. “Engineering Lead” at Team Lead."
          icon={<Briefcase />}
          action={canManage && <Button size="sm" onClick={() => setTitle({})}><Plus /> Title</Button>}
        />
        {designations.isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : !designations.data?.length ? (
          <EmptyState icon={<Briefcase />} title="No job titles yet" description="Add titles and place them at a level." />
        ) : (
          <div className="space-y-3 border-t border-border p-4">
            {groups.filter((g) => g.titles.length).map((g) => (
              <div key={g.level?.id ?? 'none'}>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.level && <span className="h-2 w-2 rounded-full" style={{ background: g.level.color ?? 'currentColor' }} />}
                  {g.level?.name ?? 'No level'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {g.titles.map((t) => (
                    <span key={t.id} className="group inline-flex items-center gap-1 rounded-full border border-border bg-surface py-0.5 pl-2.5 pr-1 text-xs">
                      {t.name}
                      <span className="text-muted-foreground">· {t._count?.employees ?? 0}</span>
                      {canManage && (
                        <>
                          <button type="button" aria-label={`Edit ${t.name}`} onClick={() => setTitle(t)} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                          <button
                            type="button"
                            aria-label={`Delete ${t.name}`}
                            onClick={() => removeTitle.mutate(t.id, { onSuccess: () => toast.success(`${t.name} deleted`), onError: fail('Could not delete the title') })}
                            className="rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <LevelDialog value={level} onClose={() => setLevel(null)} />
      <TitleDialog value={title} levels={list} onClose={() => setTitle(null)} />
    </div>
  );
}

function LevelDialog({ value, onClose }: { value: Partial<OrgLevel> | null; onClose: () => void }) {
  const create = useCreateLevel();
  const update = useUpdateLevel();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366F1');
  useEffect(() => {
    if (value) {
      setName(value.name ?? '');
      setColor(value.color ?? '#6366F1');
    }
  }, [value]);
  if (!value) return null;
  const busy = create.isPending || update.isPending;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const done = { onSuccess: () => { toast.success(value.id ? 'Level updated' : 'Level added at the bottom — reorder as needed'); onClose(); }, onError: fail('Could not save the level') };
    if (value.id) update.mutate({ id: value.id, name: name.trim(), color }, done);
    else create.mutate({ name: name.trim(), color }, done);
  };
  return (
    <Modal open onClose={onClose} busy={busy} icon={<Layers />} title={value.id ? `Edit ${value.name}` : 'New level'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="level-form" loading={busy}>Save</Button></>}>
      <form id="level-form" onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="l-name" required>
          <Input id="l-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus maxLength={40} placeholder="e.g. Senior Manager" />
        </Field>
        <Field label="Colour" htmlFor="l-color" hint="Shown on the org chart.">
          <ColorInput id="l-color" value={color} onChange={setColor} />
        </Field>
      </form>
    </Modal>
  );
}

function TitleDialog({ value, levels, onClose }: { value: Partial<Designation> | null; levels: OrgLevel[]; onClose: () => void }) {
  const save = useSaveDesignation();
  const [name, setName] = useState('');
  const [levelId, setLevelId] = useState('');
  useEffect(() => {
    if (value) {
      setName(value.name ?? '');
      setLevelId(value.orgLevelId ?? '');
    }
  }, [value]);
  if (!value) return null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(
      { id: value.id, name: name.trim(), orgLevelId: levelId || null },
      { onSuccess: () => { toast.success(value.id ? 'Title updated' : 'Title added'); onClose(); }, onError: fail('Could not save the title') },
    );
  };
  return (
    <Modal open onClose={onClose} busy={save.isPending} icon={<Briefcase />} title={value.id ? `Edit ${value.name}` : 'New job title'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="title-form" loading={save.isPending}>Save</Button></>}>
      <form id="title-form" onSubmit={submit} className="space-y-4">
        <Field label="Title" htmlFor="t-name" required>
          <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="e.g. Engineering Lead" />
        </Field>
        <Field label="Level" htmlFor="t-level" hint={levels.length ? undefined : 'Create org levels first to place titles at a level.'}>
          <select id="t-level" className={inputClass} value={levelId} onChange={(e) => setLevelId(e.target.value)}>
            <option value="">— No level</option>
            {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
      </form>
    </Modal>
  );
}

// ─── Locations ──────────────────────────────────────────────

export function LocationsPanel({ canManage }: { canManage: boolean }) {
  const locations = useLocations();
  const remove = useDeleteLocation();
  const [editing, setEditing] = useState<Partial<OfficeLocation> | null>(null);
  if (locations.isError) return <ErrorState message={getApiErrorMessage(locations.error, 'Could not load locations')} onRetry={() => locations.refetch()} />;
  return (
    <Card>
      <CardHeader title="Locations" description="Offices and sites. Roles can use a “Location” scope (e.g. branch HR)." icon={<MapPin />}
        action={canManage && <Button size="sm" onClick={() => setEditing({})}><Plus /> Location</Button>} />
      {locations.isLoading ? (
        <div className="space-y-2 p-4">{Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : !locations.data?.length ? (
        <EmptyState icon={<MapPin />} title="No locations yet" description="Add your offices." />
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {locations.data.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">{l.name}{l.isDefault && <Badge tone="primary"><Star className="h-3 w-3" /> Default</Badge>}</p>
                <p className="truncate text-xs text-muted-foreground">{[l.city, l.state, l.country].filter(Boolean).join(', ')} · {l._count?.employees ?? 0} employees</p>
              </div>
              {canManage && (
                <>
                  <IconButton label={`Edit ${l.name}`} onClick={() => setEditing(l)}><Pencil /></IconButton>
                  <IconButton label={`Delete ${l.name}`} danger onClick={() => remove.mutate(l.id, { onSuccess: () => toast.success(`${l.name} deleted`), onError: fail('Could not delete the location') })}><Trash2 /></IconButton>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <LocationDialog value={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

function LocationDialog({ value, onClose }: { value: Partial<OfficeLocation> | null; onClose: () => void }) {
  const save = useSaveLocation();
  const [form, setForm] = useState({ name: '', city: '', state: '', country: 'India', isDefault: false });
  useEffect(() => {
    if (value) setForm({ name: value.name ?? '', city: value.city ?? '', state: value.state ?? '', country: value.country ?? 'India', isDefault: value.isDefault ?? false });
  }, [value]);
  if (!value) return null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(
      { id: value.id, name: form.name.trim(), city: form.city.trim() || undefined, state: form.state.trim() || undefined, country: form.country.trim() || undefined, isDefault: form.isDefault },
      { onSuccess: () => { toast.success(value.id ? 'Location updated' : 'Location added'); onClose(); }, onError: fail('Could not save the location') },
    );
  };
  return (
    <Modal open onClose={onClose} busy={save.isPending} icon={<MapPin />} title={value.id ? `Edit ${value.name}` : 'New location'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="loc-form" loading={save.isPending}>Save</Button></>}>
      <form id="loc-form" onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="loc-name" required>
          <Input id="loc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus placeholder="Bengaluru HQ" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="City" htmlFor="loc-city"><Input id="loc-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="State" htmlFor="loc-state"><Input id="loc-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
          <Field label="Country" htmlFor="loc-country"><Input id="loc-country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
          Default location for new employees
        </label>
      </form>
    </Modal>
  );
}
