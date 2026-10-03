'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, ShieldCheck, Tags } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { ColorInput, Field, Input, Textarea, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useAccess } from '@/lib/access/use-access';
import { ACCRUAL_LABEL, LEAVE_CATEGORIES, useLeaveTypes, useSaveLeaveType, type LeaveType, type LeaveTypeInput } from '@/lib/company/leave';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

const pretty = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export default function LeaveTypesPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const allowed = hasFeature('time.leave') && can('leave.manage_types');
  const types = useLeaveTypes(true, allowed);
  const [editing, setEditing] = useState<LeaveType | 'new' | null>(null);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" description="You can’t manage leave types." />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Time" title="Leave types" description="What people can take, how much, and who approves it." action={<Button onClick={() => setEditing('new')}><Plus /> Add type</Button>} />
      <Card className="overflow-hidden">
        {types.isLoading ? (
          <div className="space-y-2 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : types.isError ? (
          <ErrorState message={getApiErrorMessage(types.error)} onRetry={() => types.refetch()} />
        ) : (
          <ul className="divide-y divide-border">
            {types.data!.map((t) => (
              <li key={t.id} className={cn('flex flex-wrap items-center gap-3 px-5 py-3', !t.isActive && 'opacity-55')}>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {t.name} <span className="font-mono text-xs text-muted-foreground">{t.code}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.accrual === 'NONE' ? 'Unlimited' : `${t.annualQuota} days / year · ${ACCRUAL_LABEL[t.accrual].toLowerCase()}`}
                    {t.carryForward && ` · carry forward up to ${t.maxCarryForward}`}
                    {' · '}
                    {t.approvalLevels === 0 ? 'auto-approved' : `${t.approvalLevels} approval level${t.approvalLevels === 1 ? '' : 's'}`}
                    {t.minNoticeDays > 0 && ` · ${t.minNoticeDays} days notice`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {!t.isPaid && <Badge>Unpaid</Badge>}
                  {t.countsAsPresent && <Badge tone="info">Counts as working</Badge>}
                  {t.gender && <Badge tone="outline">{pretty(t.gender)} only</Badge>}
                  {!t.isActive && <Badge>Inactive</Badge>}
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)}><Pencil /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <TypeDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

const EMPTY: LeaveTypeInput = {
  name: '',
  code: '',
  category: 'OTHER',
  description: null,
  color: '#6366F1',
  accrual: 'UPFRONT',
  annualQuota: 0,
  carryForward: false,
  maxCarryForward: 0,
  isPaid: true,
  allowHalfDay: true,
  approvalLevels: 1,
  minNoticeDays: 0,
  maxConsecutiveDays: null,
  includeNonWorkingDays: false,
  countsAsPresent: false,
  gender: null,
  isActive: true,
  sortOrder: 100,
};

function TypeDialog({ value, onClose }: { value: LeaveType | 'new' | null; onClose: () => void }) {
  const save = useSaveLeaveType();
  const [f, setF] = useState<LeaveTypeInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!value) return;
    setError(null);
    if (value === 'new') setF(EMPTY);
    else {
      const { id: _id, ...rest } = value;
      setF(rest);
    }
  }, [value]);
  if (!value) return null;
  const set = <K extends keyof LeaveTypeInput>(k: K, v: LeaveTypeInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const check = (k: 'carryForward' | 'isPaid' | 'allowHalfDay' | 'includeNonWorkingDays' | 'countsAsPresent' | 'isActive', label: string, hint: string) => (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={f[k]} onChange={(e) => set(k, e.target.checked)} disabled={k === 'carryForward' && f.accrual === 'NONE'} />
      <span><span className="font-medium">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
    </label>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({ ...f, ...(value !== 'new' && { id: value.id }), annualQuota: Number(f.annualQuota), maxCarryForward: Number(f.maxCarryForward) });
      toast.success(value === 'new' ? 'Leave type added' : 'Leave type saved');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      icon={<Tags />}
      title={value === 'new' ? 'Add leave type' : `Edit ${value.name}`}
      description="Changes apply to new requests. Existing balances keep their numbers for this year."
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="type-form" loading={save.isPending}>Save</Button>
        </>
      }
    >
      <form id="type-form" onSubmit={submit} className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_160px]">
          <Field label="Name" htmlFor="lt-name" required><Input id="lt-name" value={f.name} onChange={(e) => set('name', e.target.value)} required minLength={2} maxLength={60} /></Field>
          <Field label="Code" htmlFor="lt-code" required><Input id="lt-code" value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} required maxLength={8} className="font-mono uppercase" /></Field>
          <Field label="Colour" htmlFor="lt-color"><ColorInput id="lt-color" value={f.color} onChange={(v) => set('color', v)} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Category" htmlFor="lt-cat">
            <select id="lt-cat" className={inputClass} value={f.category} onChange={(e) => set('category', e.target.value)}>
              {LEAVE_CATEGORIES.map((c) => <option key={c} value={c}>{pretty(c)}</option>)}
            </select>
          </Field>
          <Field label="Balance" htmlFor="lt-accrual">
            <select id="lt-accrual" className={inputClass} value={f.accrual} onChange={(e) => set('accrual', e.target.value as LeaveTypeInput['accrual'])}>
              <option value="UPFRONT">Yearly quota (up front)</option>
              <option value="MONTHLY">Yearly quota (monthly)</option>
              <option value="NONE">Unlimited</option>
            </select>
          </Field>
          <Field label="Days per year" htmlFor="lt-quota">
            <Input id="lt-quota" type="number" step="0.5" min={0} max={366} value={f.annualQuota} onChange={(e) => set('annualQuota', Number(e.target.value))} disabled={f.accrual === 'NONE'} />
          </Field>
          <Field label="Approval levels" htmlFor="lt-levels" hint="0 = approved automatically">
            <select id="lt-levels" className={inputClass} value={f.approvalLevels} onChange={(e) => set('approvalLevels', Number(e.target.value))}>
              <option value={0}>None (auto)</option>
              <option value={1}>1 — manager</option>
              <option value={2}>2 — manager + their manager</option>
              <option value={3}>3 levels</option>
            </select>
          </Field>
          <Field label="Notice (days)" htmlFor="lt-notice"><Input id="lt-notice" type="number" min={0} max={365} value={f.minNoticeDays} onChange={(e) => set('minNoticeDays', Number(e.target.value))} /></Field>
          <Field label="Max days at a time" htmlFor="lt-max" hint="Blank = no limit">
            <Input id="lt-max" type="number" min={1} max={366} value={f.maxConsecutiveDays ?? ''} onChange={(e) => set('maxConsecutiveDays', e.target.value ? Number(e.target.value) : null)} />
          </Field>
          <Field label="Only for" htmlFor="lt-gender">
            <select id="lt-gender" className={inputClass} value={f.gender ?? ''} onChange={(e) => set('gender', (e.target.value || null) as LeaveTypeInput['gender'])}>
              <option value="">Everyone</option>
              <option value="FEMALE">Women</option>
              <option value="MALE">Men</option>
            </select>
          </Field>
          {f.carryForward && (
            <Field label="Carry forward up to" htmlFor="lt-carry"><Input id="lt-carry" type="number" step="0.5" min={0} max={366} value={f.maxCarryForward} onChange={(e) => set('maxCarryForward', Number(e.target.value))} /></Field>
          )}
        </div>
        <Field label="Description" htmlFor="lt-desc"><Textarea id="lt-desc" value={f.description ?? ''} onChange={(e) => set('description', e.target.value || null)} maxLength={300} rows={2} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          {check('carryForward', 'Carry forward unused days', 'Into next year, up to the limit above')}
          {check('isPaid', 'Paid leave', 'Untick for loss-of-pay leave')}
          {check('allowHalfDay', 'Allow half days', 'First or second half of a single day')}
          {check('includeNonWorkingDays', 'Count weekly offs & holidays', 'e.g. maternity leave')}
          {check('countsAsPresent', 'Counts as a working day', 'e.g. work from home')}
          {check('isActive', 'Active', 'Inactive types can’t be requested')}
        </div>
      </form>
    </Modal>
  );
}
