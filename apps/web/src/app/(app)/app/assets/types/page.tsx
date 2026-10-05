'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Gift, Minus, Pencil, Plus, ShieldCheck, Tags, Trash2, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton, Tabs } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ProductArt } from '@/components/assets/product-art';
import { useAccess } from '@/lib/access/use-access';
import { useDepartments } from '@/lib/company/org';
import { useRoles } from '@/lib/company/user-management';
import { ASSET_ICONS, useAssetTypes, useKits, useRemoveKit, useSaveAssetType, useSaveKit, type AssetIcon, type AssetType, type KitRule } from '@/lib/company/assets';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

const ICON_LABEL: Record<AssetIcon, string> = { laptop: 'Laptop', monitor: 'Monitor', phone: 'Phone', idcard: 'Card', headset: 'Headset', keyboard: 'Keyboard', sim: 'SIM', box: 'Other' };

export default function AssetTypesPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const allowed = hasFeature('ops.assets') && can('asset.manage');
  const types = useAssetTypes(true, allowed);
  const [tab, setTab] = useState<'types' | 'kits'>('types');
  const [editing, setEditing] = useState<AssetType | 'new' | null>(null);
  const [kit, setKit] = useState<KitRule | 'new' | null>(null);
  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assets"
        title="Asset types"
        description="Kinds of equipment you track, and the starter kits new joiners get automatically."
        action={tab === 'types' ? <Button onClick={() => setEditing('new')}><Plus /> Add type</Button> : <Button onClick={() => setKit('new')}><Plus /> Add kit rule</Button>}
      />
      <Tabs tabs={[{ id: 'types' as const, label: 'Types', icon: <Tags /> }, { id: 'kits' as const, label: 'Starter kits', icon: <Gift /> }]} value={tab} onChange={setTab} />
      {tab === 'types' ? (
        types.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
        ) : types.isError ? (
          <ErrorState message={getApiErrorMessage(types.error, 'Could not load types')} onRetry={() => void types.refetch()} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {types.data?.map((t) => (
              <Card key={t.id} className={cn('pa-hover flex gap-4 p-4', !t.isActive && 'opacity-55')}>
                <ProductArt icon={t.icon} size="xs" className="mt-1" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex items-center gap-2 font-semibold">{t.name} <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs">{t.prefix}</span></p>
                  {t.description && <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {!t.isActive && <Badge>Inactive</Badge>}
                    {t.requestable ? <Badge tone="success">Requestable</Badge> : <Badge tone="neutral">IT only</Badge>}
                    {t.loanable && <Badge tone="primary">Loan{t.maxLoanDays ? ` ≤ ${t.maxLoanDays}d` : ''}</Badge>}
                    {t.warrantyMonths ? <Badge tone="neutral">{t.warrantyMonths} mo warranty</Badge> : null}
                    {t.minStock > 0 && <Badge tone="neutral">Keep {t.minStock}</Badge>}
                  </div>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)}><Pencil /></Button>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Kits onEdit={setKit} />
      )}
      <TypeDialog value={editing} onClose={() => setEditing(null)} />
      <KitDialog value={kit} onClose={() => setKit(null)} types={types.data ?? []} />
    </div>
  );
}

// ─── Type editor ────────────────────────────────────────────

type TypeForm = {
  name: string; prefix: string; isActive: boolean; icon: AssetIcon; description: string; warrantyMonths: string; replaceAfterYears: string; minStock: string;
  requestable: boolean; loanable: boolean; maxLoanDays: string; fields: string[]; checklist: string[];
};
const BLANK: TypeForm = { name: '', prefix: '', isActive: true, icon: 'box', description: '', warrantyMonths: '', replaceAfterYears: '', minStock: '0', requestable: true, loanable: false, maxLoanDays: '', fields: [], checklist: [] };
const num = (s: string) => (s.trim() === '' ? null : Number(s));

function TypeDialog({ value, onClose }: { value: AssetType | 'new' | null; onClose: () => void }) {
  const save = useSaveAssetType();
  const [f, setF] = useState<TypeForm>(BLANK);
  useEffect(() => {
    if (!value) return;
    setF(value === 'new' ? BLANK : {
      name: value.name, prefix: value.prefix, isActive: value.isActive, icon: value.icon, description: value.description ?? '',
      warrantyMonths: value.warrantyMonths?.toString() ?? '', replaceAfterYears: value.replaceAfterYears?.toString() ?? '', minStock: String(value.minStock),
      requestable: value.requestable, loanable: value.loanable, maxLoanDays: value.maxLoanDays?.toString() ?? '', fields: value.fields, checklist: value.checklist,
    });
  }, [value]);
  if (!value) return null;
  const set = <K extends keyof TypeForm>(k: K, v: TypeForm[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync({
        ...(value !== 'new' && { id: value.id }),
        name: f.name, prefix: f.prefix, isActive: f.isActive, icon: f.icon, description: f.description || null,
        warrantyMonths: num(f.warrantyMonths), replaceAfterYears: num(f.replaceAfterYears), minStock: num(f.minStock) ?? 0,
        requestable: f.requestable, loanable: f.loanable, maxLoanDays: f.loanable ? num(f.maxLoanDays) : null,
        fields: f.fields.map((x) => x.trim()).filter(Boolean), checklist: f.checklist.map((x) => x.trim()).filter(Boolean),
      });
      toast.success('Type saved');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };

  return (
    <Modal open onClose={onClose} busy={save.isPending} icon={<Tags />} title={value === 'new' ? 'Add asset type' : `Edit ${value.name}`} className="sm:max-w-2xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="type-form" loading={save.isPending}>Save</Button></>}>
      <form id="type-form" onSubmit={submit} className="space-y-4">
        <Field label="Picture">
          <div className="flex flex-wrap gap-1.5">
            {ASSET_ICONS.map((i) => (
              <button key={i} type="button" onClick={() => set('icon', i)} aria-pressed={f.icon === i} className={cn('pa-hover flex flex-col items-center rounded-lg border-[1.5px] px-1.5 pb-1 pt-1.5 text-2xs', f.icon === i ? 'border-primary bg-primary-soft/50' : 'border-border hover:bg-subtle')}>
                <ProductArt icon={i} size="xs" />
                {ICON_LABEL[i]}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="Name" htmlFor="ty-name" required><Input id="ty-name" value={f.name} onChange={(e) => set('name', e.target.value)} required minLength={2} maxLength={40} /></Field>
          <Field label="Tag prefix" htmlFor="ty-prefix" required hint="Existing tags don’t change">
            <Input id="ty-prefix" value={f.prefix} onChange={(e) => set('prefix', e.target.value.toUpperCase())} required pattern="[A-Z0-9]{2,6}" maxLength={6} className="font-mono" />
          </Field>
        </div>
        <Field label="Description" htmlFor="ty-desc" hint="Shown to employees when they request"><Input id="ty-desc" value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={200} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Warranty (months)" htmlFor="ty-war" hint="Default for new assets"><Input id="ty-war" type="number" min={0} max={120} value={f.warrantyMonths} onChange={(e) => set('warrantyMonths', e.target.value)} /></Field>
          <Field label="Replace after (years)" htmlFor="ty-rep"><Input id="ty-rep" type="number" min={1} max={20} value={f.replaceAfterYears} onChange={(e) => set('replaceAfterYears', e.target.value)} /></Field>
          <Field label="Keep in stock" htmlFor="ty-min" hint="Warn below this"><Input id="ty-min" type="number" min={0} max={1000} value={f.minStock} onChange={(e) => set('minStock', e.target.value)} /></Field>
        </div>
        <div className="space-y-2 rounded-lg bg-subtle p-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={f.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Active</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={f.requestable} onChange={(e) => set('requestable', e.target.checked)} /> Employees can request it</label>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={f.loanable} onChange={(e) => set('loanable', e.target.checked)} /> Can be lent for a few days</label>
            {f.loanable && <span className="flex items-center gap-1.5 text-muted-foreground">— up to <Input type="number" min={1} max={365} value={f.maxLoanDays} onChange={(e) => set('maxLoanDays', e.target.value)} className="h-8 w-20" aria-label="Longest loan in days" /> days</span>}
          </div>
        </div>
        <ListEditor label="Extra details to record" hint="e.g. RAM, Storage, IMEI — shown on the asset form" items={f.fields} onChange={(v) => set('fields', v)} max={40} placeholder="Field name" />
        <ListEditor label="Hand-over checklist" hint="IT ticks these when handing over, e.g. Charger included" items={f.checklist} onChange={(v) => set('checklist', v)} max={80} placeholder="Checklist item" />
      </form>
    </Modal>
  );
}

function ListEditor({ label, hint, items, onChange, max, placeholder }: { label: string; hint: string; items: string[]; onChange: (v: string[]) => void; max: number; placeholder: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v) && items.length < 20) onChange([...items, v]);
    setDraft('');
  };
  return (
    <Field label={label} hint={hint}>
      <div className="space-y-2">
        {items.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {items.map((x) => (
              <span key={x} className="flex items-center gap-1 rounded-full bg-muted py-0.5 pl-2.5 pr-1 text-xs">
                {x}
                <button type="button" aria-label={`Remove ${x}`} onClick={() => onChange(items.filter((y) => y !== x))} className="rounded-full p-0.5 hover:bg-background [&_svg]:size-3"><X /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} maxLength={max} placeholder={placeholder} />
          <Button type="button" variant="secondary" onClick={add} disabled={!draft.trim()}><Plus /> Add</Button>
        </div>
      </div>
    </Field>
  );
}

// ─── Starter kits ───────────────────────────────────────────

const SYSTEM_ROLES: Array<{ key: string; name: string }> = [
  { key: 'employee', name: 'Employee' },
  { key: 'team_lead', name: 'Team lead' },
  { key: 'manager', name: 'Manager' },
  { key: 'hr', name: 'HR' },
  { key: 'it_admin', name: 'IT admin' },
  { key: 'pmo', name: 'PMO' },
  { key: 'finance', name: 'Finance' },
];

function useRoleOptions() {
  const roles = useRoles();
  const custom = (roles.data ?? []).filter((r) => r.key && r.status === 'ACTIVE' && !SYSTEM_ROLES.some((s) => s.key === r.key)).map((r) => ({ key: r.key!, name: r.name }));
  return [...SYSTEM_ROLES, ...custom];
}

function Kits({ onEdit }: { onEdit: (k: KitRule) => void }) {
  const kits = useKits();
  const remove = useRemoveKit();
  const depts = useDepartments();
  const roles = useRoleOptions();
  if (kits.isLoading) return <Skeleton className="h-48 w-full" />;
  if (kits.isError) return <ErrorState message={getApiErrorMessage(kits.error, 'Could not load starter kits')} onRetry={() => void kits.refetch()} />;
  const who = (k: KitRule) => {
    if (k.isBase) return 'Everyone who joins';
    const parts = [
      k.roleKeys.length && `roles: ${k.roleKeys.map((r) => roles.find((x) => x.key === r)?.name ?? r).join(', ')}`,
      k.designationContains && `designation has “${k.designationContains}”`,
      k.departmentIds.length && `department: ${k.departmentIds.map((d) => depts.data?.find((x) => x.id === d)?.name ?? '…').join(', ')}`,
    ].filter(Boolean);
    return parts.join(' or ');
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">When someone is added as an employee, every matching rule adds its items to a starter kit. IT gets a “to hand over” list — no approvals needed. Rules marked <b>on promotion</b> also apply when someone’s role, designation or department changes.</p>
      {!kits.data?.length ? (
        <EmptyState icon={<Gift />} title="No starter kits" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {kits.data.map((k) => (
            <Card key={k.id} className={cn('space-y-3 p-4', !k.isActive && 'opacity-55')}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">{k.name}{k.isBase && <Badge tone="primary">Base</Badge>}{k.onPromotion && <Badge tone="info">On promotion</Badge>}{!k.isActive && <Badge>Off</Badge>}</p>
                  <p className="text-xs text-muted-foreground">{who(k)}</p>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${k.name}`} onClick={() => onEdit(k)}><Pencil /></Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Delete ${k.name}`} loading={remove.isPending && remove.variables === k.id} onClick={() => remove.mutate(k.id, { onSuccess: () => toast.success('Kit rule deleted'), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not delete')) })}><Trash2 /></Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {k.items.map((i) => (
                  <span key={i.typeId} className="pa-hover flex items-center gap-1.5 rounded-lg bg-subtle py-1 pl-1 pr-2.5 text-xs font-medium">
                    <ProductArt icon={i.type?.icon ?? 'box'} size="xs" />
                    {i.qty > 1 && `${i.qty} × `}{i.type?.name ?? 'Removed type'}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

type KitForm = { name: string; isBase: boolean; roleKeys: string[]; designationContains: string; departmentIds: string[]; items: Array<{ typeId: string; qty: number }>; onPromotion: boolean; isActive: boolean };

function KitDialog({ value, onClose, types }: { value: KitRule | 'new' | null; onClose: () => void; types: AssetType[] }) {
  const save = useSaveKit();
  const depts = useDepartments();
  const roles = useRoleOptions();
  const [f, setF] = useState<KitForm>({ name: '', isBase: false, roleKeys: [], designationContains: '', departmentIds: [], items: [], onPromotion: false, isActive: true });
  useEffect(() => {
    if (!value) return;
    setF(value === 'new'
      ? { name: '', isBase: false, roleKeys: [], designationContains: '', departmentIds: [], items: [], onPromotion: false, isActive: true }
      : { name: value.name, isBase: value.isBase, roleKeys: value.roleKeys, designationContains: value.designationContains ?? '', departmentIds: value.departmentIds, items: value.items.map(({ typeId, qty }) => ({ typeId, qty })), onPromotion: value.onPromotion, isActive: value.isActive });
  }, [value]);
  if (!value) return null;
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const qty = (typeId: string) => f.items.find((i) => i.typeId === typeId)?.qty ?? 0;
  const setQty = (typeId: string, n: number) => setF({ ...f, items: n <= 0 ? f.items.filter((i) => i.typeId !== typeId) : f.items.some((i) => i.typeId === typeId) ? f.items.map((i) => (i.typeId === typeId ? { ...i, qty: n } : i)) : [...f.items, { typeId, qty: n }] });
  const noWho = !f.isBase && !f.roleKeys.length && !f.designationContains.trim() && !f.departmentIds.length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync({ ...(value !== 'new' && { id: value.id }), ...f, designationContains: f.designationContains.trim() || null, ...(f.isBase && { roleKeys: [], designationContains: null, departmentIds: [] }) });
      toast.success('Kit rule saved');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save'));
    }
  };

  return (
    <Modal open onClose={onClose} busy={save.isPending} icon={<Gift />} title={value === 'new' ? 'Add a starter kit rule' : `Edit ${value.name}`} className="sm:max-w-2xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="kit-form" loading={save.isPending} disabled={!f.items.length || noWho}>Save</Button></>}>
      <form id="kit-form" onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="kt-name" required><Input id="kt-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} maxLength={60} placeholder="e.g. Sales team extras" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={f.isBase} onChange={(e) => setF({ ...f, isBase: e.target.checked })} /> Base kit — everyone who joins gets this</label>
        {!f.isBase && (
          <div className="space-y-3 rounded-lg bg-subtle p-3">
            <p className="text-xs font-medium text-muted-foreground">Who gets it — anyone matching <b>any</b> of these</p>
            <Field label="Roles">
              <div className="flex flex-wrap gap-1.5">
                {roles.map((r) => (
                  <button key={r.key} type="button" onClick={() => setF({ ...f, roleKeys: toggle(f.roleKeys, r.key) })} className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', f.roleKeys.includes(r.key) ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface hover:bg-muted')}>{r.name}</button>
                ))}
              </div>
            </Field>
            <Field label="Designation contains" htmlFor="kt-des" hint="e.g. Senior — matches “Senior Developer”, “Senior Designer”…"><Input id="kt-des" value={f.designationContains} onChange={(e) => setF({ ...f, designationContains: e.target.value })} maxLength={60} /></Field>
            {(depts.data?.length ?? 0) > 0 && (
              <Field label="Departments">
                <div className="flex flex-wrap gap-1.5">
                  {depts.data!.map((d) => (
                    <button key={d.id} type="button" onClick={() => setF({ ...f, departmentIds: toggle(f.departmentIds, d.id) })} className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', f.departmentIds.includes(d.id) ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface hover:bg-muted')}>{d.name}</button>
                  ))}
                </div>
              </Field>
            )}
          </div>
        )}
        <Field label="Items">
          <div className="grid gap-2 sm:grid-cols-2">
            {types.filter((t) => t.isActive).map((t) => {
              const n = qty(t.id);
              return (
                <div key={t.id} className={cn('flex items-center gap-2 rounded-lg border px-2 py-1.5', n ? 'border-primary bg-primary-soft/30' : 'border-border')}>
                  <ProductArt icon={t.icon} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={`Fewer ${t.name}`} disabled={!n} onClick={() => setQty(t.id, n - 1)}><Minus /></Button>
                  <span className="w-4 text-center text-sm font-semibold tabular-nums">{n}</span>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={`More ${t.name}`} disabled={n >= 5} onClick={() => setQty(t.id, n + 1)}><Plus /></Button>
                </div>
              );
            })}
          </div>
        </Field>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={f.onPromotion} onChange={(e) => setF({ ...f, onPromotion: e.target.checked })} /> Also on promotion — when someone newly matches this rule</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Active</label>
        </div>
      </form>
    </Modal>
  );
}
