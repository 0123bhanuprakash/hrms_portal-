'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, FileUp, HardDrive, PackagePlus, RotateCcw, UserPlus, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ProductArt } from '@/components/assets/product-art';
import { useOrgChart } from '@/lib/company/org';
import {
  CONDITIONS,
  CONDITION_LABEL,
  useAssetTypes,
  useAssignAsset,
  useImportAssets,
  useReportProblem,
  useRequestMatches,
  useReturnAsset,
  useSaveAsset,
  useSetAssetStatus,
  type Asset,
  type AssetCondition,
  type AssetRequest,
  type HeldAsset,
} from '@/lib/company/assets';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';

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
  const [specs, setSpecs] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!value) return;
    if (value === 'new') {
      setSpecs({});
      return setF({ ...EMPTY, typeId: types.data?.[0]?.id ?? '' });
    }
    setSpecs(value.specs ?? {});
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

  const type = types.data?.find((t) => t.id === f.typeId);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const a = await save.mutateAsync({
        ...(value !== 'new' && { id: value.id }),
        ...f,
        tag: f.tag || null,
        purchaseCost: f.purchaseCost ? Number(f.purchaseCost) : null,
        specs: Object.fromEntries((type?.fields ?? []).map((k) => [k, specs[k] ?? ''])),
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
        <Field label="Asset tag" htmlFor="af-tag" hint={value === 'new' ? `Blank = next ${type?.prefix ?? ''} number` : undefined}>
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
        <Field label="Warranty until" htmlFor="af-warranty" hint={type?.warrantyMonths && !f.warrantyUntil ? `Blank = purchase date + ${type.warrantyMonths} months` : undefined}><Input id="af-warranty" type="date" value={f.warrantyUntil} onChange={(e) => set('warrantyUntil', e.target.value)} /></Field>
        {(type?.fields ?? []).map((k) => (
          <Field key={k} label={k} htmlFor={`af-spec-${k}`}><Input id={`af-spec-${k}`} value={specs[k] ?? ''} onChange={(e) => setSpecs({ ...specs, [k]: e.target.value })} maxLength={120} /></Field>
        ))}
        <Field label="Notes" htmlFor="af-notes" className="sm:col-span-2"><Textarea id="af-notes" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} maxLength={500} /></Field>
      </form>
    </Modal>
  );
}

// ─── Assign (hand over without a request) ───────────────────

export function AssignDialog({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const assign = useAssignAsset();
  const chart = useOrgChart();
  const [employeeId, setEmployeeId] = useState('');
  const [condition, setCondition] = useState<AssetCondition>('GOOD');
  const [notes, setNotes] = useState('');
  const [loan, setLoan] = useState(false);
  const [dueBack, setDueBack] = useState('');
  const [ticked, setTicked] = useState<string[]>([]);
  useEffect(() => {
    if (!asset) return;
    setEmployeeId('');
    setCondition(asset.condition);
    setNotes('');
    setLoan(false);
    setDueBack('');
    setTicked([]);
  }, [asset]);
  const people = useMemo(
    () => (chart.data?.employees ?? []).filter((e) => e.employmentStatus !== 'TERMINATED').sort((a, b) => a.firstName.localeCompare(b.firstName)),
    [chart.data],
  );
  if (!asset) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const a = await assign.mutateAsync({ id: asset.id, employeeId, condition, notes: notes || null, checklist: ticked, dueBack: loan ? dueBack || null : null });
      toast.success(`${a.tag} handed to ${a.holder?.employee.firstName}`);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not assign'));
    }
  };

  return (
    <Modal open onClose={onClose} busy={assign.isPending} icon={<UserPlus />} title={`Hand over ${asset.tag}`} description="They’ll get a notification to confirm they received it." className="sm:max-w-md" footer={footer('assign-form', onClose, assign.isPending, 'Hand over', !employeeId || (loan && !dueBack))}>
      <form id="assign-form" onSubmit={submit} className="space-y-3">
        <Field label="Employee" htmlFor="as-emp" required>
          <select id="as-emp" className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
            <option value="">{chart.isLoading ? 'Loading…' : 'Choose someone'}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.employeeId})</option>)}
          </select>
        </Field>
        <Field label="Condition at hand-over" htmlFor="as-cond"><ConditionSelect id="as-cond" value={condition} onChange={setCondition} /></Field>
        {asset.type.loanable && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={loan} onChange={(e) => setLoan(e.target.checked)} /> A loan — it comes back on a date</label>
        )}
        {loan && <Field label="Due back" htmlFor="as-due" required><Input id="as-due" type="date" value={dueBack} onChange={(e) => setDueBack(e.target.value)} required /></Field>}
        <Checklist items={asset.type.checklist} ticked={ticked} onChange={setTicked} />
        <Field label="Notes" htmlFor="as-notes"><Input id="as-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
      </form>
    </Modal>
  );
}

function Checklist({ items, ticked, onChange }: { items: string[]; ticked: string[]; onChange: (t: string[]) => void }) {
  if (!items.length) return null;
  return (
    <Field label="Hand-over checklist">
      <div className="space-y-1.5 rounded-lg bg-subtle p-3">
        {items.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={ticked.includes(c)} onChange={(e) => onChange(e.target.checked ? [...ticked, c] : ticked.filter((x) => x !== c))} />
            {c}
          </label>
        ))}
      </div>
    </Field>
  );
}

// ─── Hand over an approved request: best match, condition, checklist ──

export function HandOverDialog({ request, onClose }: { request: AssetRequest | null; onClose: () => void }) {
  const assign = useAssignAsset();
  const matches = useRequestMatches(request?.id);
  const [assetId, setAssetId] = useState('');
  const [condition, setCondition] = useState<AssetCondition>('GOOD');
  const [ticked, setTicked] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  useEffect(() => {
    setAssetId('');
    setTicked([]);
    setNotes('');
  }, [request]);
  useEffect(() => {
    const first = matches.data?.[0];
    if (first && !assetId) {
      setAssetId(first.id);
      setCondition(first.condition);
    }
  }, [matches.data, assetId]);
  if (!request) return null;
  const options = matches.data ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const asset = options.find((a) => a.id === assetId);
    try {
      await assign.mutateAsync({ id: assetId, employeeId: request.employee.id, requestId: request.id, condition, checklist: ticked, notes: notes || null });
      toast.success(`${asset?.tag} handed to ${request.employee.firstName}`);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not hand over'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={assign.isPending}
      icon={<PackagePlus />}
      title={`Hand over a ${request.type.name.toLowerCase()} to ${request.employee.firstName}`}
      description={request.source === 'KIT' ? `Starter kit${request.neededBy ? ` — ready by ${formatDate(request.neededBy)}` : ''}` : `Approved${request.kind === 'LOAN' ? ` · loan until ${formatDate(request.loanUntil)}` : ''}`}
      className="sm:max-w-lg"
      footer={footer('handover-form', onClose, assign.isPending, assetId ? `Hand over ${options.find((a) => a.id === assetId)?.tag ?? ''}` : 'Hand over', !assetId)}
    >
      <form id="handover-form" onSubmit={submit} className="space-y-3">
        <Field label="Best match from stock" hint={!matches.isLoading && !options.length ? `No ${request.type.name.toLowerCase()} is available — add one to the register first.` : 'Newest condition and longest warranty first'}>
          <div className="space-y-1.5">
            {options.map((a, i) => (
              <button
                key={a.id}
                type="button"
                onClick={() => { setAssetId(a.id); setCondition(a.condition); }}
                className={cn('flex w-full items-center gap-3 rounded-xl border-[1.5px] px-3 py-2 text-left transition-colors', assetId === a.id ? 'border-primary bg-primary-soft/50' : 'border-border hover:bg-subtle')}
              >
                <ProductArt icon={request.type.icon} size="xs" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold"><span className="font-mono">{a.tag}</span> · {a.name}</span>
                  <span className="block text-xs text-muted-foreground">{CONDITION_LABEL[a.condition]}{a.warrantyUntil ? ` · warranty till ${formatDate(a.warrantyUntil)}` : ''}{i === 0 ? ' · best match' : ''}</span>
                </span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Condition at hand-over" htmlFor="ho-cond"><ConditionSelect id="ho-cond" value={condition} onChange={setCondition} /></Field>
        <Checklist items={request.type.checklist} ticked={ticked} onChange={setTicked} />
        <Field label="Notes" htmlFor="ho-notes"><Input id="ho-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
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
      toast.success(a.status === 'IN_REPAIR' ? `${a.tag} returned — sent for repair` : `${a.tag} returned and available`);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not record the return'));
    }
  };

  return (
    <Modal open onClose={onClose} busy={ret.isPending} icon={<RotateCcw />} title={`Take back ${asset.tag}`} description={asset.holder ? `From ${asset.holder.employee.firstName} ${asset.holder.employee.lastName}.` : undefined} className="sm:max-w-md" footer={footer('return-form', onClose, ret.isPending, 'Record return')}>
      <form id="return-form" onSubmit={submit} className="space-y-3">
        <Field label="Condition now" htmlFor="rt-cond" hint={condition === 'DAMAGED' ? 'Damaged assets go to repair (a repair job is opened).' : undefined}><ConditionSelect id="rt-cond" value={condition} onChange={setCondition} /></Field>
        <Field label="Notes" htmlFor="rt-notes"><Input id="rt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
      </form>
    </Modal>
  );
}

// ─── Status (repair / lost / retired / available) ───────────

const STATUS_TEXT = {
  AVAILABLE: { title: 'Mark available', text: 'Back in stock and ready to hand over.' },
  IN_REPAIR: { title: 'Send for repair', text: 'It can’t be handed over until it’s back.' },
  LOST: { title: 'Mark as lost', text: 'If someone holds it, their assignment is closed.' },
  RETIRED: { title: 'Retire', text: 'Kept for history; it can’t be handed over again.' },
} as const;

export function StatusDialog({ value, onClose }: { value: { asset: Asset; status: keyof typeof STATUS_TEXT } | null; onClose: () => void }) {
  const set = useSetAssetStatus();
  const [notes, setNotes] = useState('');
  const [issue, setIssue] = useState('');
  const [vendor, setVendor] = useState('');
  const [cost, setCost] = useState('');
  useEffect(() => {
    setNotes('');
    setIssue('');
    setVendor('');
    setCost('');
  }, [value]);
  if (!value) return null;
  const t = STATUS_TEXT[value.status];
  const repairing = value.status === 'IN_REPAIR';
  const backFromRepair = value.status === 'AVAILABLE' && value.asset.status === 'IN_REPAIR';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await set.mutateAsync({ id: value.asset.id, status: value.status, notes: notes || null, ...(repairing && { issue: issue || null, vendor: vendor || null }), ...(backFromRepair && cost && { repairCost: Number(cost) }) });
      toast.success(repairing ? 'Sent for repair' : backFromRepair ? 'Back from repair' : 'Status updated');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update'));
    }
  };

  return (
    <Modal open onClose={onClose} busy={set.isPending} icon={<Wrench />} title={`${backFromRepair ? 'Back from repair' : t.title}: ${value.asset.tag}`} description={t.text} className="sm:max-w-md" footer={footer('status-form', onClose, set.isPending, backFromRepair ? 'Mark available' : t.title, repairing && issue.trim().length < 3)}>
      <form id="status-form" onSubmit={submit} className="space-y-3">
        {repairing && (
          <>
            <Field label="What’s wrong?" htmlFor="st-issue" required><Input id="st-issue" value={issue} onChange={(e) => setIssue(e.target.value)} maxLength={300} placeholder="e.g. Battery drains in an hour" /></Field>
            <Field label="Repaired by" htmlFor="st-vendor" hint="Vendor or service centre (optional)"><Input id="st-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} maxLength={100} /></Field>
          </>
        )}
        {backFromRepair && <Field label="Repair cost (₹)" htmlFor="st-cost" hint="Optional"><Input id="st-cost" type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>}
        <Field label="Note" htmlFor="st-notes"><Input id="st-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
      </form>
    </Modal>
  );
}

// ─── Report a problem (an IT ticket) ────────────────────────

export function ProblemDialog({ held, onClose }: { held: HeldAsset | null; onClose: () => void }) {
  const report = useReportProblem();
  const [text, setText] = useState('');
  useEffect(() => setText(''), [held]);
  if (!held) return null;
  return (
    <Modal
      open
      onClose={onClose}
      busy={report.isPending}
      icon={<AlertTriangle />}
      title={`Problem with ${held.asset.tag}`}
      description="IT gets a helpdesk ticket linked to this asset."
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={report.isPending}
            disabled={text.trim().length < 10}
            onClick={async () => {
              try {
                const r = await report.mutateAsync({ assignmentId: held.id, description: text.trim() });
                toast.success(r.ticket ? `Ticket #${r.ticket.number} opened — IT will get back to you` : 'IT has been told');
                onClose();
              } catch (err) {
                toast.error(getApiErrorMessage(err, 'Could not report it'));
              }
            }}
          >
            Report to IT
          </Button>
        </>
      }
    >
      <Field label="What’s wrong?" htmlFor="pb-text" required hint="At least a sentence — when it happens, what you see">
        <Textarea id="pb-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="e.g. The screen flickers a few minutes after waking up" autoFocus />
      </Field>
    </Modal>
  );
}

// ─── Import from CSV ────────────────────────────────────────

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const imp = useImportAssets();
  const [csv, setCsv] = useState('');
  const [check, setCheck] = useState<{ rows: number; valid: number; errors: Array<{ line: number; errors: string[] }> } | null>(null);
  useEffect(() => {
    if (open) {
      setCsv('');
      setCheck(null);
    }
  }, [open]);
  if (!open) return null;
  const run = async (dryRun: boolean) => {
    try {
      const r = await imp.mutateAsync({ csv, dryRun });
      if (dryRun || r.errors.length) setCheck(r);
      else {
        toast.success(`Added ${r.created} asset${r.created === 1 ? '' : 's'}`);
        onClose();
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not read the file'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={imp.isPending}
      icon={<FileUp />}
      title="Import assets from a spreadsheet"
      description="CSV columns: type, name, tag, brand, model, serial, purchase date (YYYY-MM-DD), cost, vendor, warranty until. Blank tag = automatic."
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" onClick={() => void run(true)} loading={imp.isPending} disabled={csv.trim().length < 5}>Check</Button>
          <Button onClick={() => void run(false)} loading={imp.isPending} disabled={!check || check.errors.length > 0}>Import {check ? check.valid : ''}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <input
          type="file"
          accept=".csv,text/csv"
          className="block text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              setCsv(await f.text());
              setCheck(null);
            }
          }}
        />
        <Textarea rows={8} value={csv} onChange={(e) => { setCsv(e.target.value); setCheck(null); }} placeholder={'type,name,tag,brand,model,serial,purchase date,cost\nLaptop,MacBook Air,,Apple,M3,C02X…,2026-01-10,95000'} className="font-mono text-xs" />
        {check && (
          <div className={cn('rounded-lg px-3 py-2 text-sm', check.errors.length ? 'bg-destructive-soft text-destructive' : 'bg-success-soft text-success')}>
            {check.errors.length ? (
              <>
                <b>{check.errors.length} row{check.errors.length === 1 ? '' : 's'} to fix</b> — nothing is imported until all rows are fine.
                <ul className="mt-1 list-disc pl-5 text-xs">{check.errors.slice(0, 8).map((e) => <li key={e.line}>Row {e.line}: {e.errors.join(', ')}</li>)}</ul>
              </>
            ) : (
              <b>All {check.valid} rows look fine — ready to import.</b>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><ProductArt icon="box" size="xs" /> Tip: export your old spreadsheet as CSV and paste it here.</div>
      </div>
    </Modal>
  );
}
