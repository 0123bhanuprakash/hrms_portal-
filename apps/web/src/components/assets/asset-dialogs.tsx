'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { HardDrive, PackagePlus, RotateCcw, UserPlus, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useOrgChart } from '@/lib/company/org';
import {
  CONDITIONS,
  CONDITION_LABEL,
  useAssetTypes,
  useAssets,
  useAssignAsset,
  useRequestAsset,
  useReturnAsset,
  useSaveAsset,
  useSetAssetStatus,
  type Asset,
  type AssetCondition,
  type AssetRequest,
} from '@/lib/company/assets';
import { getApiErrorMessage } from '@/lib/errors';

const footer = (formId: string, onClose: () => void, busy: boolean, label: string, disabled = false) => (
  <>
    <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
    <Button type="submit" form={formId} loading={busy} disabled={disabled}>{label}</Button>
  </>
);

function ConditionSelect({ id, value, onChange }: { id: string; value: AssetCondition; onChange: (c: AssetCondition) => void }) {
  return (
    <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value as AssetCondition)}>
      {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
    </select>
  );
}

// ─── Add / edit an asset ─────────────────────────────────────

const EMPTY = { typeId: '', tag: '', name: '', brand: '', model: '', serialNumber: '', purchaseDate: '', purchaseCost: '', vendor: '', warrantyUntil: '', condition: 'NEW' as AssetCondition, notes: '' };

export function AssetFormDialog({ value, onClose, onSaved }: { value: Asset | 'new' | null; onClose: () => void; onSaved?: (a: Asset) => void }) {
  const save = useSaveAsset();
  const types = useAssetTypes(false, Boolean(value));
  const [f, setF] = useState(EMPTY);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!value) return;
    if (value === 'new') return setF({ ...EMPTY, typeId: types.data?.[0]?.id ?? '' });
    setF({
      typeId: value.type.id,
      tag: value.tag,
      name: value.name,
      brand: value.brand ?? '',
      model: value.model ?? '',
      serialNumber: value.serialNumber ?? '',
      purchaseDate: value.purchaseDate ?? '',
      purchaseCost: value.purchaseCostPaise !== null ? String(value.purchaseCostPaise / 100) : '',
      vendor: value.vendor ?? '',
      warrantyUntil: value.warrantyUntil ?? '',
      condition: value.condition,
      notes: value.notes ?? '',
    });
  }, [value, types.data]);
  if (!value) return null;

  const prefix = types.data?.find((t) => t.id === f.typeId)?.prefix;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const a = await save.mutateAsync({
        ...(value !== 'new' && { id: value.id }),
        ...f,
        tag: f.tag || null,
        purchaseCost: f.purchaseCost ? Number(f.purchaseCost) : null,
      });
      toast.success(value === 'new' ? `${a.tag} added` : 'Asset saved');
      onSaved?.(a);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save the asset'));
    }
  };

  return (
    <Modal open onClose={onClose} busy={save.isPending} icon={<HardDrive />} title={value === 'new' ? 'Add an asset' : `Edit ${value.tag}`} className="sm:max-w-xl" footer={footer('asset-form', onClose, save.isPending, 'Save')}>
      <form id="asset-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Type" htmlFor="af-type" required>
          <select id="af-type" className={inputClass} value={f.typeId} onChange={(e) => set('typeId', e.target.value)} required>
            {types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Asset tag" htmlFor="af-tag" hint={value === 'new' ? `Blank = next ${prefix ?? ''} number` : undefined}>
          <Input id="af-tag" value={f.tag} onChange={(e) => set('tag', e.target.value)} placeholder={value === 'new' ? 'Automatic' : undefined} maxLength={30} pattern="[A-Za-z0-9\-]{2,30}" />
        </Field>
        <Field label="Name" htmlFor="af-name" required className="sm:col-span-2">
          <Input id="af-name" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. MacBook Pro 14 (M3)" required minLength={2} maxLength={100} />
        </Field>
        <Field label="Brand" htmlFor="af-brand"><Input id="af-brand" value={f.brand} onChange={(e) => set('brand', e.target.value)} maxLength={60} /></Field>
        <Field label="Model" htmlFor="af-model"><Input id="af-model" value={f.model} onChange={(e) => set('model', e.target.value)} maxLength={60} /></Field>
        <Field label="Serial number" htmlFor="af-serial"><Input id="af-serial" value={f.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} maxLength={80} /></Field>
        <Field label="Condition" htmlFor="af-cond"><ConditionSelect id="af-cond" value={f.condition} onChange={(c) => set('condition', c)} /></Field>
        <Field label="Purchase date" htmlFor="af-pdate"><Input id="af-pdate" type="date" value={f.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} /></Field>
        <Field label="Cost (₹)" htmlFor="af-cost"><Input id="af-cost" type="number" min={0} step="0.01" value={f.purchaseCost} onChange={(e) => set('purchaseCost', e.target.value)} /></Field>
        <Field label="Vendor" htmlFor="af-vendor"><Input id="af-vendor" value={f.vendor} onChange={(e) => set('vendor', e.target.value)} maxLength={100} /></Field>
        <Field label="Warranty until" htmlFor="af-warranty"><Input id="af-warranty" type="date" value={f.warrantyUntil} onChange={(e) => set('warrantyUntil', e.target.value)} /></Field>
        <Field label="Notes" htmlFor="af-notes" className="sm:col-span-2"><Textarea id="af-notes" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} maxLength={500} /></Field>
      </form>
    </Modal>
  );
}

// ─── Assign (hand over) ─────────────────────────────────────

export function AssignDialog({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const assign = useAssignAsset();
  const chart = useOrgChart();
  const [employeeId, setEmployeeId] = useState('');
  const [condition, setCondition] = useState<AssetCondition>('GOOD');
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (!asset) return;
    setEmployeeId('');
    setCondition(asset.condition);
    setNotes('');
  }, [asset]);
  const people = useMemo(
    () => (chart.data?.employees ?? []).filter((e) => e.employmentStatus !== 'TERMINATED').sort((a, b) => a.firstName.localeCompare(b.firstName)),
    [chart.data],
  );
  if (!asset) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const a = await assign.mutateAsync({ id: asset.id, employeeId, condition, notes: notes || null });
      toast.success(`${a.tag} handed to ${a.holder?.employee.firstName}`);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not assign'));
    }
  };

  return (
    <Modal open onClose={onClose} busy={assign.isPending} icon={<UserPlus />} title={`Hand over ${asset.tag}`} description="They’ll get a notification to confirm they received it." className="sm:max-w-md" footer={footer('assign-form', onClose, assign.isPending, 'Hand over', !employeeId)}>
      <form id="assign-form" onSubmit={submit} className="space-y-3">
        <Field label="Employee" htmlFor="as-emp" required>
          <select id="as-emp" className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
            <option value="">{chart.isLoading ? 'Loading…' : 'Choose someone'}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.employeeId})</option>)}
          </select>
        </Field>
        <Field label="Condition at hand-over" htmlFor="as-cond"><ConditionSelect id="as-cond" value={condition} onChange={setCondition} /></Field>
        <Field label="Notes" htmlFor="as-notes" hint="e.g. With charger and bag"><Input id="as-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
      </form>
    </Modal>
  );
}

// ─── Fulfil an approved request ─────────────────────────────

export function FulfilDialog({ request, onClose }: { request: AssetRequest | null; onClose: () => void }) {
  const assign = useAssignAsset();
  const free = useAssets({ status: 'AVAILABLE', typeId: request?.type.id, limit: 100 }, Boolean(request));
  const [assetId, setAssetId] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => {
    setAssetId('');
    setNotes('');
  }, [request]);
  if (!request) return null;
  const options = free.data?.data ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const asset = options.find((a) => a.id === assetId);
    try {
      await assign.mutateAsync({ id: assetId, employeeId: request.employee.id, requestId: request.id, condition: asset?.condition, notes: notes || null });
      toast.success(`${asset?.tag} handed to ${request.employee.firstName}`);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not hand over'));
    }
  };

  return (
    <Modal open onClose={onClose} busy={assign.isPending} icon={<PackagePlus />} title={`Hand over a ${request.type.name.toLowerCase()}`} description={`To ${request.employee.firstName} ${request.employee.lastName} — approved by IT and HR.`} className="sm:max-w-md" footer={footer('fulfil-form', onClose, assign.isPending, 'Hand over', !assetId)}>
      <form id="fulfil-form" onSubmit={submit} className="space-y-3">
        <Field label="Asset" htmlFor="ff-asset" required hint={!free.isLoading && !options.length ? `No ${request.type.name.toLowerCase()} is available. Add one to the register first.` : undefined}>
          <select id="ff-asset" className={inputClass} value={assetId} onChange={(e) => setAssetId(e.target.value)} required disabled={!options.length}>
            <option value="">{free.isLoading ? 'Loading…' : options.length ? 'Choose an available one' : 'None available'}</option>
            {options.map((a) => <option key={a.id} value={a.id}>{a.tag} — {a.name} ({CONDITION_LABEL[a.condition]})</option>)}
          </select>
        </Field>
        <Field label="Notes" htmlFor="ff-notes"><Input id="ff-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
      </form>
    </Modal>
  );
}

// ─── Return ─────────────────────────────────────────────────

export function ReturnDialog({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const ret = useReturnAsset();
  const [condition, setCondition] = useState<AssetCondition>('GOOD');
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (!asset) return;
    setCondition(asset.condition === 'NEW' ? 'GOOD' : asset.condition);
    setNotes('');
  }, [asset]);
  if (!asset) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const a = await ret.mutateAsync({ id: asset.id, condition, notes: notes || null });
      toast.success(a.status === 'IN_REPAIR' ? `${a.tag} returned — marked in repair` : `${a.tag} returned and available`);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not record the return'));
    }
  };

  return (
    <Modal open onClose={onClose} busy={ret.isPending} icon={<RotateCcw />} title={`Take back ${asset.tag}`} description={asset.holder ? `From ${asset.holder.employee.firstName} ${asset.holder.employee.lastName}.` : undefined} className="sm:max-w-md" footer={footer('return-form', onClose, ret.isPending, 'Record return')}>
      <form id="return-form" onSubmit={submit} className="space-y-3">
        <Field label="Condition now" htmlFor="rt-cond" hint={condition === 'DAMAGED' ? 'Damaged assets go to “In repair”.' : undefined}><ConditionSelect id="rt-cond" value={condition} onChange={setCondition} /></Field>
        <Field label="Notes" htmlFor="rt-notes"><Input id="rt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
      </form>
    </Modal>
  );
}

// ─── Status (repair / lost / retired / available) ───────────

const STATUS_TEXT = {
  AVAILABLE: { title: 'Mark available', text: 'Back in stock and ready to hand over.' },
  IN_REPAIR: { title: 'Send for repair', text: 'It can’t be handed over until it’s marked available.' },
  LOST: { title: 'Mark as lost', text: 'If someone holds it, their assignment is closed.' },
  RETIRED: { title: 'Retire', text: 'Kept for history; it can’t be handed over again.' },
} as const;

export function StatusDialog({ value, onClose }: { value: { asset: Asset; status: keyof typeof STATUS_TEXT } | null; onClose: () => void }) {
  const set = useSetAssetStatus();
  const [notes, setNotes] = useState('');
  useEffect(() => setNotes(''), [value]);
  if (!value) return null;
  const t = STATUS_TEXT[value.status];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await set.mutateAsync({ id: value.asset.id, status: value.status, notes: notes || null });
      toast.success('Status updated');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update'));
    }
  };

  return (
    <Modal open onClose={onClose} busy={set.isPending} icon={<Wrench />} title={`${t.title}: ${value.asset.tag}`} description={t.text} className="sm:max-w-md" footer={footer('status-form', onClose, set.isPending, t.title)}>
      <form id="status-form" onSubmit={submit}>
        <Field label="Note" htmlFor="st-notes"><Input id="st-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
      </form>
    </Modal>
  );
}

// ─── Request an asset (employee) ────────────────────────────

export function RequestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const req = useRequestAsset();
  const types = useAssetTypes(false, open);
  const [typeId, setTypeId] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) {
      setTypeId('');
      setReason('');
    }
  }, [open]);
  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await req.mutateAsync({ typeId, reason });
      toast.success('Request sent to the IT head and HR');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send the request'));
    }
  };

  return (
    <Modal open onClose={onClose} busy={req.isPending} icon={<PackagePlus />} title="Request an asset" description="The IT head and HR both approve, then IT hands it over." className="sm:max-w-md" footer={footer('request-form', onClose, req.isPending, 'Send request', !typeId)}>
      <form id="request-form" onSubmit={submit} className="space-y-3">
        <Field label="What do you need?" htmlFor="rq-type" required>
          <select id="rq-type" className={inputClass} value={typeId} onChange={(e) => setTypeId(e.target.value)} required>
            <option value="">Choose a type</option>
            {types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Why?" htmlFor="rq-reason" required hint="e.g. Second monitor for design work">
          <Textarea id="rq-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={5} maxLength={500} />
        </Field>
      </form>
    </Modal>
  );
}
