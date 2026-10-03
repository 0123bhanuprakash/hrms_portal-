'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardEdit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { dayLabel, hhmm, useRequestCorrection, useUpsertRecord, type CalendarDay, type DayStatus } from '@/lib/company/attendance';
import { getApiErrorMessage } from '@/lib/errors';

/**
 * Employee: request a correction (goes to the manager).
 * HR (mode "edit"): set the day directly — times, or a status like On leave.
 */
export function CorrectionDialog({
  day,
  timeZone,
  onClose,
  mode = 'request',
  employeeId,
  employeeName,
}: {
  day: Pick<CalendarDay, 'date' | 'checkIn' | 'checkOut' | 'notes'> | null;
  timeZone: string;
  onClose: () => void;
  mode?: 'request' | 'edit';
  employeeId?: string;
  employeeName?: string;
}) {
  const request = useRequestCorrection();
  const upsert = useUpsertRecord();
  const busy = request.isPending || upsert.isPending;
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'' | DayStatus>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!day) return;
    setCheckIn(hhmm(day.checkIn, timeZone) || '09:30');
    setCheckOut(hhmm(day.checkOut, timeZone) || '18:30');
    setReason(mode === 'edit' ? (day.notes ?? '') : '');
    setStatus('');
    setError(null);
  }, [day, timeZone, mode]);

  if (!day) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (mode === 'request') {
        await request.mutateAsync({ date: day.date, checkIn, checkOut: checkOut || null, reason });
        toast.success('Correction sent to your manager');
      } else {
        await upsert.mutateAsync(
          status
            ? { employeeId: employeeId!, date: day.date, status, notes: reason || null }
            : { employeeId: employeeId!, date: day.date, checkIn, checkOut: checkOut || null, notes: reason || null },
        );
        toast.success('Attendance updated');
      }
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      icon={<ClipboardEdit />}
      title={mode === 'request' ? `Correct ${dayLabel(day.date)}` : `Edit ${employeeName ? `${employeeName} · ` : ''}${dayLabel(day.date)}`}
      description={mode === 'request' ? 'Your manager approves the change before it shows on your attendance.' : 'Saved straight away and marked as a manual entry.'}
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="correction-form" loading={busy}>{mode === 'request' ? 'Send request' : 'Save'}</Button>
        </>
      }
    >
      <form id="correction-form" onSubmit={submit} className="space-y-3">
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {mode === 'edit' && (
          <Field label="Mark the day as" htmlFor="cr-status">
            <select id="cr-status" className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as DayStatus | '')}>
              <option value="">Worked — use the times below</option>
              <option value="ON_LEAVE">On leave</option>
              <option value="ABSENT">Absent</option>
              <option value="WORK_FROM_HOME">Work from home</option>
              <option value="HOLIDAY">Holiday</option>
            </select>
          </Field>
        )}
        {!status && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Check in" htmlFor="cr-in" required>
              <Input id="cr-in" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
            </Field>
            <Field label="Check out" htmlFor="cr-out">
              <Input id="cr-out" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </Field>
          </div>
        )}
        <Field label={mode === 'request' ? 'Reason' : 'Note'} htmlFor="cr-reason" required={mode === 'request'} hint={`Times are in ${timeZone.replace(/_/g, ' ')}`}>
          <Textarea
            id="cr-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required={mode === 'request'}
            minLength={mode === 'request' ? 3 : undefined}
            maxLength={500}
            rows={3}
            placeholder={mode === 'request' ? 'e.g. Forgot to check out, card reader was down' : ''}
          />
        </Field>
      </form>
    </Modal>
  );
}
