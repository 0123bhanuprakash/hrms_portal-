'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Clock, Save, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { useAccess } from '@/lib/access/use-access';
import { WEEKDAY_NAMES, usePolicy, useSavePolicy, type AttendancePolicy } from '@/lib/company/attendance';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

type Form = Omit<AttendancePolicy, 'timeZone' | 'halfDayMinutes' | 'fullDayMinutes'> & { halfDayHours: string; fullDayHours: string };

export default function AttendanceSettingsPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const allowed = hasFeature('time.attendance') && can('attendance.policy');
  const policy = usePolicy(allowed);
  const save = useSavePolicy();
  const [f, setF] = useState<Form | null>(null);

  useEffect(() => {
    const p = policy.data;
    if (!p) return;
    setF({
      workDays: p.workDays,
      shiftStart: p.shiftStart,
      shiftEnd: p.shiftEnd,
      graceMinutes: p.graceMinutes,
      halfDayHours: String(p.halfDayMinutes / 60),
      fullDayHours: String(p.fullDayMinutes / 60),
      regularisationWindowDays: p.regularisationWindowDays,
      webCheckInEnabled: p.webCheckInEnabled,
    });
  }, [policy.data]);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="No access" description="You can’t change attendance settings." />;
  if (policy.isLoading || !f) return policy.isError ? <ErrorState message={getApiErrorMessage(policy.error)} onRetry={() => policy.refetch()} /> : <Skeleton className="h-96 w-full" />;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setF((prev) => (prev ? { ...prev, [key]: value } : prev));
  const toggleDay = (d: number) => set('workDays', f.workDays.includes(d) ? f.workDays.filter((x) => x !== d) : [...f.workDays, d].sort());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync({
        workDays: f.workDays,
        shiftStart: f.shiftStart,
        shiftEnd: f.shiftEnd,
        graceMinutes: Number(f.graceMinutes),
        halfDayMinutes: Math.round(Number(f.halfDayHours) * 60),
        fullDayMinutes: Math.round(Number(f.fullDayHours) * 60),
        regularisationWindowDays: Number(f.regularisationWindowDays),
        webCheckInEnabled: f.webCheckInEnabled,
      });
      toast.success('Attendance settings saved');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save settings'));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHeader
        eyebrow="Time"
        title="Attendance settings"
        description={`Rules for the whole company. Times are in ${policy.data!.timeZone.replace(/_/g, ' ')}.`}
        action={<Button type="submit" loading={save.isPending}><Save /> Save</Button>}
      />

      <Card>
        <CardHeader icon={<Clock />} title="Working week & shift" />
        <div className="space-y-5 px-5 pb-5">
          <Field label="Working days">
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={f.workDays.includes(d)}
                  onClick={() => toggleDay(d)}
                  className={cn(
                    'h-9 w-12 rounded-md border text-sm font-medium transition-colors',
                    f.workDays.includes(d) ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-muted-foreground hover:bg-subtle',
                  )}
                >
                  {WEEKDAY_NAMES[d]}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Shift starts" htmlFor="pol-start">
              <Input id="pol-start" type="time" value={f.shiftStart} onChange={(e) => set('shiftStart', e.target.value)} required />
            </Field>
            <Field label="Shift ends" htmlFor="pol-end">
              <Input id="pol-end" type="time" value={f.shiftEnd} onChange={(e) => set('shiftEnd', e.target.value)} required />
            </Field>
            <Field label="Grace period (minutes)" htmlFor="pol-grace" hint="Check-ins within this are not late">
              <Input id="pol-grace" type="number" min={0} max={240} value={f.graceMinutes} onChange={(e) => set('graceMinutes', Number(e.target.value))} required />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Day rules" description="How worked hours turn into a day’s status" />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-3">
          <Field label="Full day (hours)" htmlFor="pol-full" hint="At least this → Present">
            <Input id="pol-full" type="number" step="0.25" min={1} max={24} value={f.fullDayHours} onChange={(e) => set('fullDayHours', e.target.value)} required />
          </Field>
          <Field label="Half day (hours)" htmlFor="pol-half" hint="At least this → Half day; less → Absent">
            <Input id="pol-half" type="number" step="0.25" min={0.5} max={24} value={f.halfDayHours} onChange={(e) => set('halfDayHours', e.target.value)} required />
          </Field>
          <Field label="Correction window (days)" htmlFor="pol-window" hint="How far back employees can request corrections">
            <Input id="pol-window" type="number" min={0} max={365} value={f.regularisationWindowDays} onChange={(e) => set('regularisationWindowDays', Number(e.target.value))} required />
          </Field>
          <label className="flex items-start gap-2 text-sm sm:col-span-3">
            <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={f.webCheckInEnabled} onChange={(e) => set('webCheckInEnabled', e.target.checked)} />
            <span>
              <span className="font-medium">Allow web check-in</span>
              <span className="block text-xs text-muted-foreground">Employees check in and out from the portal. Turn off if attendance comes only from devices or HR entries.</span>
            </span>
          </label>
        </div>
      </Card>
    </form>
  );
}
