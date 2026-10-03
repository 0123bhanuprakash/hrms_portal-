'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CalendarPlus, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { days, previewLeave, useApplyLeave, useLeaveBalances, type HalfDay, type LeavePreview } from '@/lib/company/leave';
import { getApiErrorMessage } from '@/lib/errors';

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Apply for leave with a live check (days, balance after, problems) before sending. */
export function ApplyLeaveDialog({ open, onClose, initialTypeCode }: { open: boolean; onClose: () => void; initialTypeCode?: string | null }) {
  const balances = useLeaveBalances(undefined, new Date().getFullYear(), open);
  const apply = useApplyLeave();
  const [typeId, setTypeId] = useState('');
  const [start, setStart] = useState(todayKey);
  const [end, setEnd] = useState(todayKey);
  const [halfDay, setHalfDay] = useState<'' | HalfDay>('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<LeavePreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const types = useMemo(() => balances.data?.balances ?? [], [balances.data]);
  const type = types.find((b) => b.leaveType.id === typeId)?.leaveType;

  useEffect(() => {
    if (!open) return;
    setStart(todayKey());
    setEnd(todayKey());
    setHalfDay('');
    setReason('');
    setPreview(null);
    setError(null);
  }, [open]);
  useEffect(() => {
    if (!open || !types.length) return;
    const wanted = initialTypeCode ? types.find((b) => b.leaveType.code === initialTypeCode) : undefined;
    setTypeId((current) => (current && types.some((b) => b.leaveType.id === current) && !wanted ? current : (wanted ?? types[0]!).leaveType.id));
  }, [open, types, initialTypeCode]);

  const single = start === end;
  useEffect(() => {
    if (!single || (type && !type.allowHalfDay)) setHalfDay('');
  }, [single, type]);

  // Live preview (debounced)
  useEffect(() => {
    if (!open || !typeId || !start || !end) return;
    let cancelled = false;
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const p = await previewLeave({ leaveTypeId: typeId, startDate: start, endDate: end, halfDay: halfDay || null });
        if (!cancelled) setPreview(p);
      } catch (err) {
        if (!cancelled) setPreview({ days: 0, dates: [], available: null, after: null, errors: [getApiErrorMessage(err)], warnings: [], leaveType: { id: typeId, name: '', accrual: 'NONE', approvalLevels: 0 } });
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, typeId, start, end, halfDay]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const r = await apply.mutateAsync({ leaveTypeId: typeId, startDate: start, endDate: end, halfDay: halfDay || null, reason });
      toast.success(r.status === 'APPROVED' ? `${r.leaveType.name} approved` : `${r.leaveType.name} request sent for approval`);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not apply for leave'));
    }
  };

  const blocked = !preview || preview.errors.length > 0 || checking;

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={apply.isPending}
      icon={<CalendarPlus />}
      title="Apply for leave"
      className="sm:max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={apply.isPending}>Cancel</Button>
          <Button type="submit" form="apply-leave-form" loading={apply.isPending} disabled={blocked}>
            {preview?.leaveType.approvalLevels === 0 ? 'Apply' : 'Send for approval'}
          </Button>
        </>
      }
    >
      <form id="apply-leave-form" onSubmit={submit} className="space-y-3">
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Field label="Leave type" htmlFor="lv-type" required>
          <select id="lv-type" className={inputClass} value={typeId} onChange={(e) => setTypeId(e.target.value)} disabled={!types.length}>
            {types.map((b) => (
              <option key={b.leaveType.id} value={b.leaveType.id}>
                {b.leaveType.name} — {b.available === null ? 'unlimited' : `${b.available} available`}
              </option>
            ))}
          </select>
        </Field>
        {type?.description && <p className="-mt-1 text-xs text-muted-foreground">{type.description}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" htmlFor="lv-start" required>
            <Input id="lv-start" type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} required />
          </Field>
          <Field label="To" htmlFor="lv-end" required>
            <Input id="lv-end" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
          </Field>
        </div>
        {single && type?.allowHalfDay && (
          <Field label="Duration" htmlFor="lv-half">
            <select id="lv-half" className={inputClass} value={halfDay} onChange={(e) => setHalfDay(e.target.value as '' | HalfDay)}>
              <option value="">Full day</option>
              <option value="FIRST_HALF">First half</option>
              <option value="SECOND_HALF">Second half</option>
            </select>
          </Field>
        )}

        <div className="rounded-lg border border-border bg-subtle/50 px-3 py-2.5 text-sm" aria-live="polite">
          {checking || !preview ? (
            <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking…</p>
          ) : preview.errors.length ? (
            <ul className="space-y-1 text-destructive">
              {preview.errors.map((m) => <li key={m} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {m}</li>)}
            </ul>
          ) : (
            <div className="space-y-1">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-success" /> {days(preview.days)}
                {preview.after !== null && <span className="font-normal text-muted-foreground">· {preview.after} left after this</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {preview.leaveType.approvalLevels === 0
                  ? 'Approved automatically.'
                  : preview.leaveType.approvalLevels === 1
                    ? 'Goes to your manager for approval.'
                    : `Needs ${preview.leaveType.approvalLevels} approvals up your reporting line.`}
                {' '}Weekly offs and holidays aren’t counted{type?.includeNonWorkingDays ? ' — except for this type' : ''}.
              </p>
              {preview.route && preview.route.levels.length > 0 && (
                <div className="mt-1 space-y-0.5 border-t border-border pt-1.5 text-xs">
                  {preview.route.levels.map((l, i) => (
                    <p key={i}>
                      <span className="text-muted-foreground">{preview.route!.levels.length > 1 ? `Step ${i + 1}: ` : 'Goes to: '}</span>
                      <span className="font-medium">{l.approvers.length ? l.approvers.map((a) => `${a.firstName} ${a.lastName}`).join(' or ') : 'HR'}</span>
                      {l.label && <span className="text-muted-foreground"> — {l.label}</span>}
                    </p>
                  ))}
                </div>
              )}
              {preview.warnings.map((w) => <p key={w} className="text-xs text-warning">{w}</p>)}
            </div>
          )}
        </div>

        <Field label="Reason" htmlFor="lv-reason" required>
          <Textarea id="lv-reason" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={500} rows={3} placeholder="Visible to your approvers" />
        </Field>
      </form>
    </Modal>
  );
}
