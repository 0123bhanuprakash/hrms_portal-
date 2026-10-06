'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BellRing, CalendarClock, Pencil, Plus, ShieldCheck, Tags } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { ColorInput, Field, Input, Textarea, inputClass, FormError } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { Ring } from '@/components/time/visuals';
import { useAccess } from '@/lib/access/use-access';
import { ACCRUAL_LABEL, LEAVE_CATEGORIES, useLeaveTypes, useLeaveUsage, useRemindLapse, useSaveLeaveType, useYearEnd, type LeaveType, type LeaveTypeInput } from '@/lib/company/leave';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/pickers';

const pretty = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const expiryLabel = (mmdd: string) => `${Number(mmdd.slice(3))} ${MONTHS[Number(mmdd.slice(0, 2)) - 1]}`;

/** The policy in one plain-English sentence. */
function policySentence(t: LeaveTypeInput): string {
  const parts: string[] = [];
  if (t.accrual === 'NONE') parts.push('No limit on days');
  else parts.push(`${t.annualQuota} days a year${t.accrual === 'MONTHLY' ? `, added ${Math.round((t.annualQuota / 12) * 100) / 100} each month` : ', given up front'}`);
  if (t.maxConsecutiveDays) parts.push(`up to ${t.maxConsecutiveDays} at a time`);
  if (t.minNoticeDays) parts.push(`${t.minNoticeDays} day${t.minNoticeDays === 1 ? '' : 's'}’ notice`);
  parts.push(t.approvalLevels === 0 ? 'approved automatically' : `${t.approvalLevels} approval${t.approvalLevels === 1 ? '' : 's'}`);
  if (t.carryForward) parts.push(`up to ${t.maxCarryForward} carry into next year${t.carryExpiry ? ` (used by ${expiryLabel(t.carryExpiry)})` : ''}`);
  if (t.blockDuringProbation) parts.push('not during probation');
  if (t.documentAfterDays !== null) parts.push(`a document over ${t.documentAfterDays} day${t.documentAfterDays === 1 ? '' : 's'}`);
  if (t.sandwichRule) parts.push('weekends in between count');
  if (t.negativeBalance) parts.push(`${t.negativeBalance} day${t.negativeBalance === 1 ? '' : 's'} can be taken in advance`);
  return parts.join(' · ');
}

export default function LeaveTypesPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const allowed = hasFeature('time.leave') && can('leave.manage_types');
  const types = useLeaveTypes(true, allowed);
  const year = new Date().getFullYear();
  const usage = useLeaveUsage(year, allowed);
  const [editing, setEditing] = useState<LeaveType | 'new' | null>(null);
  const [yearEndId, setYearEndId] = useState<string | null>(null);

  useEffect(() => {
    if (!yearEndId && types.data) setYearEndId(types.data.find((t) => t.carryForward && t.isActive)?.id ?? types.data.find((t) => t.accrual !== 'NONE')?.id ?? null);
  }, [types.data, yearEndId]);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" description="You can’t manage leave types." />;
  const used = new Map((usage.data ?? []).map((u) => [u.leaveTypeId, u]));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Time" title="Leave types" description="What people can take, how much, and who approves it." action={<Button onClick={() => setEditing('new')}><Plus /> Add type</Button>} />
      {types.isError ? (
        <ErrorState message={getApiErrorMessage(types.error)} onRetry={() => types.refetch()} />
      ) : !types.data ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}</div>
      ) : (
        <div className="m-stagger grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {types.data.map((t) => {
            const u = used.get(t.id);
            return (
              <div key={t.id} className={cn('flex flex-col gap-3 rounded-xl border border-t-[3px] border-border bg-surface p-4 shadow-card', !t.isActive && 'opacity-55')} style={{ borderTopColor: t.color }}>
                <div className="flex items-start gap-3">
                  <span className="rounded-lg px-2 py-1 font-mono text-xs font-black" style={{ background: `color-mix(in srgb, ${t.color} 15%, transparent)`, color: t.color }}>{t.code}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.accrual === 'NONE' ? 'No limit' : `${t.annualQuota} / year · ${ACCRUAL_LABEL[t.accrual].toLowerCase()}`}</p>
                  </div>
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)}><Pencil /></Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge>{t.approvalLevels === 0 ? 'Auto-approved' : `${t.approvalLevels} approval${t.approvalLevels === 1 ? '' : 's'}`}</Badge>
                  {t.carryForward && <Badge tone="outline">Carry {t.maxCarryForward}{t.carryExpiry ? ` · until ${expiryLabel(t.carryExpiry)}` : ''}</Badge>}
                  {!t.isPaid && <Badge>Unpaid</Badge>}
                  {t.countsAsPresent && <Badge tone="info">Counts as working</Badge>}
                  {t.gender && <Badge tone="outline">{pretty(t.gender)} only</Badge>}
                  {t.blockDuringProbation && <Badge tone="warning">Not in probation</Badge>}
                  {t.documentAfterDays !== null && <Badge tone="primary">Doc over {t.documentAfterDays}d</Badge>}
                  {t.sandwichRule && <Badge tone="primary">Sandwich rule</Badge>}
                  {t.negativeBalance > 0 && <Badge tone="primary">−{t.negativeBalance} in advance</Badge>}
                  {!t.isActive && <Badge>Inactive</Badge>}
                </div>
                <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
                  Used this year
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="m-fill-w block h-full rounded-full" style={{ width: `${u?.percent ?? 0}%`, background: t.color }} />
                  </span>
                  <b className="tabular-nums text-foreground">{u?.percent === null || u?.percent === undefined ? `${u?.used ?? 0} d` : `${u.percent}%`}</b>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {types.data && <YearEnd types={types.data} value={yearEndId} onChange={setYearEndId} year={year} />}
      <TypeDialog value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

/** What everyone carries over / loses on 31 Dec for one type, and a reminder for people losing days. */
function YearEnd({ types, value, onChange, year }: { types: LeaveType[]; value: string | null; onChange: (id: string) => void; year: number }) {
  const q = useYearEnd(value, year);
  const remind = useRemindLapse();
  const d = q.data;
  const total = (d?.carry ?? 0) + (d?.lapse ?? 0);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <h2 className="flex-1 text-sm font-semibold">Year-end preview · 31 Dec {year}</h2>
        <Select className={cn(inputClass, 'w-56')} value={value ?? ''} onChange={(e) => onChange(e.target.value)} aria-label="Leave type">
          {types.filter((t) => t.accrual !== 'NONE').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </div>
      {q.isLoading || !d ? (
        <Skeleton className="mt-4 h-28 w-full" />
      ) : (
        <div className="mt-4 grid gap-5 md:grid-cols-[auto_1fr]">
          <div className="flex items-center gap-4">
            <Ring value={d.carry} max={Math.max(total, 1)} size={84} stroke={9} barClass="stroke-success" label={`${d.carry} days carried over`}>
              <span className="text-lg font-bold">{d.carry}</span><span className="text-[10px] text-muted-foreground">carry</span>
            </Ring>
            <Ring value={d.lapse} max={Math.max(total, 1)} size={84} stroke={9} barClass="stroke-destructive" label={`${d.lapse} days lost`}>
              <span className="text-lg font-bold">{d.lapse}</span><span className="text-[10px] text-muted-foreground">lapse</span>
            </Ring>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              If nobody takes more {d.leaveType.name.toLowerCase()}, {d.people} people would carry <b className="text-foreground">{d.carry}</b> days into {year + 1} and lose <b className="text-foreground">{d.lapse}</b>.
              {d.leaveType.carryForward === false && ' This type doesn’t carry forward.'}
            </p>
            {d.losing.length > 0 && (
              <>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {d.losing.slice(0, 8).map((x) => (
                    <li key={x.employee.id} className="flex items-center gap-1.5 rounded-full bg-subtle py-0.5 pl-0.5 pr-2.5 text-xs">
                      <PersonAvatar person={x.employee} size="xs" /> {x.employee.firstName} <b className="text-destructive">−{x.lapse}</b>
                    </li>
                  ))}
                  {d.losing.length > 8 && <li className="self-center text-xs text-muted-foreground">+{d.losing.length - 8} more</li>}
                </ul>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  loading={remind.isPending}
                  onClick={async () => {
                    try {
                      const r = await remind.mutateAsync({ id: value!, year });
                      toast.success(r.sent ? `Reminded ${r.sent} ${r.sent === 1 ? 'person' : 'people'}` : 'Everyone was already reminded');
                    } catch (err) {
                      toast.error(getApiErrorMessage(err, 'Could not send reminders'));
                    }
                  }}
                >
                  <BellRing /> Remind the {d.losing.length} {d.losing.length === 1 ? 'person' : 'people'} losing days
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
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
  blockDuringProbation: false,
  documentAfterDays: null,
  sandwichRule: false,
  negativeBalance: 0,
  carryExpiry: null,
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
  const check = (k: 'carryForward' | 'isPaid' | 'allowHalfDay' | 'includeNonWorkingDays' | 'countsAsPresent' | 'isActive' | 'blockDuringProbation' | 'sandwichRule', label: string, hint: string) => (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={f[k]} onChange={(e) => set(k, e.target.checked)} disabled={k === 'carryForward' && f.accrual === 'NONE'} />
      <span><span className="font-medium">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
    </label>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        ...f,
        ...(value !== 'new' && { id: value.id }),
        annualQuota: Number(f.annualQuota),
        maxCarryForward: Number(f.maxCarryForward),
        negativeBalance: f.accrual === 'NONE' ? 0 : Number(f.negativeBalance),
        carryExpiry: f.carryForward ? f.carryExpiry || null : null,
      });
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
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="type-form" loading={save.isPending}>Save</Button>
        </>
      }
    >
      <form id="type-form" onSubmit={submit} className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        <FormError>{error}</FormError>
        <p className="rounded-xl bg-subtle/80 px-4 py-3 text-sm font-medium leading-relaxed" aria-live="polite">
          <span className="mb-0.5 block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">In plain words</span>
          {policySentence(f)}
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_160px]">
          <Field label="Name" htmlFor="lt-name" required><Input id="lt-name" value={f.name} onChange={(e) => set('name', e.target.value)} required minLength={2} maxLength={60} /></Field>
          <Field label="Code" htmlFor="lt-code" required><Input id="lt-code" value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} required maxLength={8} className="font-mono uppercase" /></Field>
          <Field label="Colour" htmlFor="lt-color"><ColorInput id="lt-color" value={f.color} onChange={(v) => set('color', v)} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Category" htmlFor="lt-cat">
            <Select id="lt-cat" className={inputClass} value={f.category} onChange={(e) => set('category', e.target.value)}>
              {LEAVE_CATEGORIES.map((c) => <option key={c} value={c}>{pretty(c)}</option>)}
            </Select>
          </Field>
          <Field label="Balance" htmlFor="lt-accrual">
            <Select id="lt-accrual" className={inputClass} value={f.accrual} onChange={(e) => set('accrual', e.target.value as LeaveTypeInput['accrual'])}>
              <option value="UPFRONT">Yearly quota (up front)</option>
              <option value="MONTHLY">Yearly quota (monthly)</option>
              <option value="NONE">Unlimited</option>
            </Select>
          </Field>
          <Field label="Days per year" htmlFor="lt-quota">
            <Input id="lt-quota" type="number" step="0.5" min={0} max={366} value={f.annualQuota} onChange={(e) => set('annualQuota', Number(e.target.value))} disabled={f.accrual === 'NONE'} />
          </Field>
          <Field label="Approval levels" htmlFor="lt-levels" hint="0 = approved automatically">
            <Select id="lt-levels" className={inputClass} value={f.approvalLevels} onChange={(e) => set('approvalLevels', Number(e.target.value))}>
              <option value={0}>None (auto)</option>
              <option value={1}>1 — manager</option>
              <option value={2}>2 — manager + their manager</option>
              <option value={3}>3 levels</option>
            </Select>
          </Field>
          <Field label="Notice (days)" htmlFor="lt-notice"><Input id="lt-notice" type="number" min={0} max={365} value={f.minNoticeDays} onChange={(e) => set('minNoticeDays', Number(e.target.value))} /></Field>
          <Field label="Max days at a time" htmlFor="lt-max" hint="Blank = no limit">
            <Input id="lt-max" type="number" min={1} max={366} value={f.maxConsecutiveDays ?? ''} onChange={(e) => set('maxConsecutiveDays', e.target.value ? Number(e.target.value) : null)} />
          </Field>
          <Field label="Only for" htmlFor="lt-gender">
            <Select id="lt-gender" className={inputClass} value={f.gender ?? ''} onChange={(e) => set('gender', (e.target.value || null) as LeaveTypeInput['gender'])}>
              <option value="">Everyone</option>
              <option value="FEMALE">Women</option>
              <option value="MALE">Men</option>
            </Select>
          </Field>
          {f.carryForward && (
            <>
              <Field label="Carry forward up to" htmlFor="lt-carry"><Input id="lt-carry" type="number" step="0.5" min={0} max={366} value={f.maxCarryForward} onChange={(e) => set('maxCarryForward', Number(e.target.value))} /></Field>
              <Field label="Carried days must be used by" htmlFor="lt-expiry" hint="Blank = they never expire">
                <div className="flex gap-1.5">
                  <Select id="lt-expiry" className={inputClass} value={f.carryExpiry?.slice(0, 2) ?? ''} onChange={(e) => set('carryExpiry', e.target.value ? `${e.target.value}-${f.carryExpiry?.slice(3) ?? '31'}`.replace(/-(3[01])$/, (m) => (['02', '04', '06', '09', '11'].includes(e.target.value) && m === '-31' ? '-30' : m)) : null)}>
                    <option value="">Never</option>
                    {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                  </Select>
                  {f.carryExpiry && (
                    <Select aria-label="Day" className={cn(inputClass, 'w-20')} value={f.carryExpiry.slice(3)} onChange={(e) => set('carryExpiry', `${f.carryExpiry!.slice(0, 2)}-${e.target.value}`)}>
                      {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((d) => <option key={d} value={d}>{Number(d)}</option>)}
                    </Select>
                  )}
                </div>
              </Field>
            </>
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
        <div className="rounded-xl border border-border p-4">
          <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">More rules</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {check('blockDuringProbation', 'Not during probation', 'New joiners can use it once their probation is over')}
            {check('sandwichRule', 'Weekends in between count', '“Sandwich rule” — Fri + Mon off also counts Sat and Sun')}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={f.documentAfterDays !== null} onChange={(e) => set('documentAfterDays', e.target.checked ? 2 : null)} />
              <span className="flex-1">
                <span className="font-medium">Ask for a document</span>
                <span className="block text-xs text-muted-foreground">e.g. a doctor’s note for longer sick leave</span>
                {f.documentAfterDays !== null && (
                  <span className="mt-1.5 flex items-center gap-2 text-xs">When longer than <Input type="number" aria-label="Days" className="h-7 w-16 px-2 text-xs" min={0} max={365} value={f.documentAfterDays} onChange={(e) => set('documentAfterDays', Number(e.target.value))} /> days</span>
                )}
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={f.negativeBalance > 0} disabled={f.accrual === 'NONE'} onChange={(e) => set('negativeBalance', e.target.checked ? 2 : 0)} />
              <span className="flex-1">
                <span className="font-medium">Allow leave in advance</span>
                <span className="block text-xs text-muted-foreground">The balance may go below zero</span>
                {f.negativeBalance > 0 && (
                  <span className="mt-1.5 flex items-center gap-2 text-xs">Up to <Input type="number" aria-label="Days in advance" className="h-7 w-16 px-2 text-xs" min={0.5} max={30} step={0.5} value={f.negativeBalance} onChange={(e) => set('negativeBalance', Number(e.target.value))} /> days</span>
                )}
              </span>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
