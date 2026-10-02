'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAccess } from '@/lib/access/use-access';
import { useDeleteHoliday, useHolidays, useSaveHoliday, type Holiday } from '@/lib/company/attendance';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

export default function HolidaysPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const allowed = hasFeature('time.attendance') && can('attendance.view');
  const holidays = useHolidays(year, allowed);
  const remove = useDeleteHoliday();
  const [editing, setEditing] = useState<Holiday | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Holiday | null>(null);
  const canManage = can('holiday.manage');
  const todayKey = new Date().toISOString().slice(0, 10);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" description="The holiday calendar isn’t available to you." />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Time"
        title="Holiday calendar"
        description="Company holidays. They count as days off in attendance and leave."
        action={canManage && <Button onClick={() => setEditing('new')}><Plus /> Add holiday</Button>}
      />

      <div className="flex items-center gap-1">
        <Button size="icon-sm" variant="ghost" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}><ChevronLeft /></Button>
        <span className="w-16 text-center text-base font-semibold tabular-nums">{year}</span>
        <Button size="icon-sm" variant="ghost" aria-label="Next year" onClick={() => setYear((y) => y + 1)}><ChevronRight /></Button>
      </div>

      <Card className="overflow-hidden">
        {holidays.isLoading ? (
          <div className="space-y-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : holidays.isError ? (
          <ErrorState message={getApiErrorMessage(holidays.error, 'Could not load holidays')} onRetry={() => holidays.refetch()} />
        ) : !holidays.data?.length ? (
          <EmptyState
            icon={<CalendarDays />}
            title={`No holidays for ${year}`}
            description={canManage ? 'Add national and festival holidays so attendance treats them as days off.' : undefined}
            action={canManage && <Button onClick={() => setEditing('new')}><Plus /> Add holiday</Button>}
          />
        ) : (
          <ul className="divide-y divide-border">
            {holidays.data.map((h) => {
              const key = h.date.slice(0, 10);
              const d = new Date(`${key}T00:00:00Z`);
              const past = key < todayKey;
              return (
                <li key={h.id} className={cn('flex items-center gap-4 px-5 py-3', past && 'opacity-60')}>
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-border py-1 leading-tight">
                    <span className="text-2xs font-medium uppercase text-muted-foreground">{d.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })}</span>
                    <span className="text-base font-semibold tabular-nums">{d.getUTCDate()}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{h.name}</p>
                    <p className="text-xs text-muted-foreground">{d.toLocaleDateString(undefined, { weekday: 'long', timeZone: 'UTC' })}</p>
                  </div>
                  {h.isOptional && <Badge>Optional</Badge>}
                  {canManage && (
                    <div className="flex gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label={`Edit ${h.name}`} onClick={() => setEditing(h)}><Pencil /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Delete ${h.name}`} onClick={() => setDeleting(h)}><Trash2 /></Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <HolidayDialog holiday={editing} year={year} onClose={() => setEditing(null)} />
      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        isDanger
        isLoading={remove.isPending}
        title="Delete holiday?"
        description={deleting ? `“${deleting.name}” will be removed. Past attendance for that day will show as a normal working day.` : ''}
        confirmText="Delete"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast.success('Holiday deleted');
            setDeleting(null);
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not delete'));
          }
        }}
      />
    </div>
  );
}

function HolidayDialog({ holiday, year, onClose }: { holiday: Holiday | 'new' | null; year: number; onClose: () => void }) {
  const save = useSaveHoliday();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [optional, setOptional] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!holiday) return;
    setError(null);
    if (holiday === 'new') {
      setName('');
      setDate(`${year}-01-01`);
      setOptional(false);
    } else {
      setName(holiday.name);
      setDate(holiday.date.slice(0, 10));
      setOptional(holiday.isOptional);
    }
  }, [holiday, year]);

  if (!holiday) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({ id: holiday === 'new' ? undefined : holiday.id, name, date, isOptional: optional });
      toast.success(holiday === 'new' ? 'Holiday added' : 'Holiday updated');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the holiday'));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.isPending}
      icon={<CalendarDays />}
      title={holiday === 'new' ? 'Add holiday' : 'Edit holiday'}
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="holiday-form" loading={save.isPending}>Save</Button>
        </>
      }
    >
      <form id="holiday-form" onSubmit={submit} className="space-y-3">
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Field label="Name" htmlFor="hol-name" required>
          <Input id="hol-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} placeholder="e.g. Diwali" />
        </Field>
        <Field label="Date" htmlFor="hol-date" required>
          <Input id="hol-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={optional} onChange={(e) => setOptional(e.target.checked)} />
          <span>
            <span className="font-medium">Optional (restricted) holiday</span>
            <span className="block text-xs text-muted-foreground">Shown on the calendar; employees take it as leave if they want it.</span>
          </span>
        </label>
      </form>
    </Modal>
  );
}
