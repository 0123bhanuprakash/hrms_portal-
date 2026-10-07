'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Mail, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InlineRetry, Skeleton } from '@/components/ui/feedback';
import { Field, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Toggle } from '@/components/super-admin/plans-ui';
import { useAuthStore } from '@/store/useAuthStore';
import {
  useDeleteSchedule,
  useReportSchedules,
  useSaveSchedule,
  useScheduleRecipients,
  useSendSchedule,
  type ReportFilters,
  type ReportSchedule,
  type ScheduleReport,
} from '@/lib/company/reports';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/pickers';

export const REPORT_LABEL: Record<ScheduleReport, string> = { overview: 'Overview', people: 'People', attendance: 'Attendance & leave', utilisation: 'Utilisation' };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'AM' : 'PM'}`;

export function describeSchedule(s: Pick<ReportSchedule, 'frequency' | 'dayOfWeek' | 'dayOfMonth' | 'hour'>) {
  const when = hourLabel(s.hour);
  if (s.frequency === 'DAILY') return `Every day at ${when}`;
  if (s.frequency === 'WEEKLY') return `Every ${DAYS[(s.dayOfWeek ?? 1) - 1]} at ${when}`;
  return `On the ${s.dayOfMonth ?? 1}${['th', 'st', 'nd', 'rd'][((s.dayOfMonth ?? 1) % 10 > 3 || [11, 12, 13].includes(s.dayOfMonth ?? 1)) ? 0 : (s.dayOfMonth ?? 1) % 10]} of each month at ${when}`;
}

interface Draft {
  id?: string;
  report: ScheduleReport;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  dayOfWeek: number;
  dayOfMonth: number;
  hour: number;
  recipientIds: string[];
  attachCsv: boolean;
  active: boolean;
}

function ScheduleForm({ initial, available, filters, onDone }: { initial: Draft; available: ScheduleReport[]; filters: ReportFilters; onDone: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const recipients = useScheduleRecipients();
  const save = useSaveSchedule();
  const csvPossible = d.report === 'people' || d.report === 'utilisation';
  const submit = () =>
    save.mutate(
      {
        id: d.id,
        report: d.report,
        frequency: d.frequency,
        ...(d.frequency === 'WEEKLY' && { dayOfWeek: d.dayOfWeek }),
        ...(d.frequency === 'MONTHLY' && { dayOfMonth: d.dayOfMonth }),
        hour: d.hour,
        recipientIds: d.recipientIds,
        attachCsv: csvPossible && d.attachCsv,
        active: d.active,
        ...filters,
      },
      {
        onSuccess: (s) => {
          toast.success(`Scheduled · next one ${formatDateTime(s.nextRunAt)}`);
          onDone();
        },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Could not save')),
      },
    );
  return (
    <div className="space-y-4">
      <Field label="Report" htmlFor="sch-report">
        <Select id="sch-report" className={inputClass} value={d.report} onChange={(e) => setD({ ...d, report: e.target.value as ScheduleReport })}>
          {available.map((r) => <option key={r} value={r}>{REPORT_LABEL[r]}</option>)}
        </Select>
      </Field>
      <Field label="How often" htmlFor="sch-freq">
        <div id="sch-freq" className="flex w-max rounded-lg border border-border p-0.5" role="radiogroup">
          {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={d.frequency === f} onClick={() => setD({ ...d, frequency: f })} className={cn('rounded-md px-3 py-1.5 text-xs font-semibold capitalize', d.frequency === f ? 'bg-foreground text-background' : 'text-muted-foreground')}>
              {f.toLowerCase()}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        {d.frequency === 'WEEKLY' && (
          <Field label="Day" htmlFor="sch-dow">
            <Select id="sch-dow" className={inputClass} value={d.dayOfWeek} onChange={(e) => setD({ ...d, dayOfWeek: Number(e.target.value) })}>
              {DAYS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
            </Select>
          </Field>
        )}
        {d.frequency === 'MONTHLY' && (
          <Field label="Day of month" htmlFor="sch-dom">
            <Select id="sch-dom" className={inputClass} value={d.dayOfMonth} onChange={(e) => setD({ ...d, dayOfMonth: Number(e.target.value) })}>
              {Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Time" htmlFor="sch-hour" hint="Your company’s time zone">
          <Select id="sch-hour" className={inputClass} value={d.hour} onChange={(e) => setD({ ...d, hour: Number(e.target.value) })}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Send to" htmlFor="sch-to" hint="Each person gets numbers for only the people they can see.">
        <div id="sch-to" className="max-h-44 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1.5">
          {recipients.isLoading ? (
            <Skeleton className="h-20" />
          ) : recipients.isLoadingError ? (
            <InlineRetry query={recipients} message="Couldn’t load the people you can send to." />
          ) : (
            (recipients.data ?? []).map((u) => {
              const on = d.recipientIds.includes(u.id);
              return (
                <label key={u.id} className={cn('flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm', on ? 'bg-primary-soft/60' : 'hover:bg-subtle')}>
                  <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={on} onChange={() => setD({ ...d, recipientIds: on ? d.recipientIds.filter((x) => x !== u.id) : [...d.recipientIds, u.id] })} />
                  <span className="flex-1 truncate">{u.firstName} {u.lastName}</span>
                  <span className="truncate text-xs text-muted-foreground">{u.email}</span>
                </label>
              );
            })
          )}
        </div>
      </Field>
      {csvPossible && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={d.attachCsv} onChange={(e) => setD({ ...d, attachCsv: e.target.checked })} />
          Attach a CSV {d.report === 'people' ? '(employee list, for people allowed to export it)' : '(utilisation)'}
        </label>
      )}
      {(filters.departmentId || filters.locationId) && <p className="text-xs text-muted-foreground">Uses the department / location filters you have on now.</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone} disabled={save.isPending}>Cancel</Button>
        <Button onClick={submit} loading={save.isPending} disabled={!d.recipientIds.length}>{d.id ? 'Save' : 'Schedule'}</Button>
      </div>
    </div>
  );
}

/** "Email this report" — your schedules, and a form to add or change one. */
export function ScheduleDialog({ open, onClose, report, available, filters }: { open: boolean; onClose: () => void; report: ScheduleReport; available: ScheduleReport[]; filters: ReportFilters }) {
  const me = useAuthStore((s) => s.user);
  const list = useReportSchedules(open);
  const send = useSendSchedule();
  const del = useDeleteSchedule();
  const save = useSaveSchedule();
  const [editing, setEditing] = useState<Draft | null>(null);
  const blank = useMemo<Draft>(() => ({ report, frequency: 'WEEKLY', dayOfWeek: 1, dayOfMonth: 1, hour: 9, recipientIds: me ? [me.id] : [], attachCsv: false, active: true }), [report, me]);
  useEffect(() => {
    if (open && list.data && !list.data.length) setEditing(blank);
    if (!open) setEditing(null);
  }, [open, list.data, blank]);

  return (
    <Modal open={open} onClose={onClose} icon={<Mail />} title={editing ? (editing.id ? 'Change schedule' : 'Email a report') : 'Emailed reports'} description={editing ? 'A summary arrives by email with a link to the full report.' : 'Reports you’ve set up to arrive by email.'} size="lg">
      {editing ? (
        <ScheduleForm initial={editing} available={available} filters={filters} onDone={() => (list.data?.length ? setEditing(null) : onClose())} />
      ) : list.isLoadingError ? (
        <InlineRetry query={list} message="Couldn’t load your emailed reports." />
      ) : !list.data ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="space-y-3">
          <ul className="divide-y divide-border rounded-lg border border-border">
            {list.data.map((s) => (
              <li key={s.id} className="flex items-start gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold">{REPORT_LABEL[s.report]}{!s.active && <Badge tone="neutral">Paused</Badge>}{s.attachCsv && <Badge tone="info">CSV</Badge>}</span>
                  <span className="block text-xs text-muted-foreground">{describeSchedule(s)} · to {s.recipients.map((r) => r.firstName).join(', ')}</span>
                  <span className="block text-xs text-muted-foreground">{s.active ? `Next ${formatDateTime(s.nextRunAt)}` : 'Not sending'}{s.lastSentAt && ` · last sent ${formatRelative(s.lastSentAt)}`}</span>
                </span>
                <Toggle
                  on={s.active}
                  label={`${REPORT_LABEL[s.report]} schedule on`}
                  className="scale-90"
                  onChange={(on) =>
                    save.mutate(
                      { id: s.id, report: s.report, frequency: s.frequency, ...(s.dayOfWeek && { dayOfWeek: s.dayOfWeek }), ...(s.dayOfMonth && { dayOfMonth: s.dayOfMonth }), hour: s.hour, recipientIds: s.recipientIds, attachCsv: s.attachCsv, active: on, ...(s.filters ?? {}) },
                      { onSuccess: () => toast.success(on ? 'Schedule on' : 'Schedule paused'), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not change')) },
                    )
                  }
                />
                <Button size="icon-sm" variant="ghost" aria-label="Send now" title="Send now" loading={send.isPending && send.variables === s.id} onClick={() => send.mutate(s.id, { onSuccess: (r) => toast.success(`Sent to ${r.sent} ${r.sent === 1 ? 'person' : 'people'}`), onError: (e) => toast.error(getApiErrorMessage(e, 'Could not send')) })}>
                  <Send />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Change" title="Change" onClick={() => setEditing({ id: s.id, report: s.report, frequency: s.frequency, dayOfWeek: s.dayOfWeek ?? 1, dayOfMonth: s.dayOfMonth ?? 1, hour: s.hour, recipientIds: s.recipientIds, attachCsv: s.attachCsv, active: s.active })}>
                  <Pencil />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Delete" title="Delete" className="text-destructive" onClick={() => del.mutate(s.id, { onSuccess: () => toast.success('Schedule deleted') })}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex justify-between">
            <Button variant="secondary" size="sm" onClick={() => setEditing(blank)}><Plus /> New schedule</Button>
            <Button size="sm" onClick={onClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
